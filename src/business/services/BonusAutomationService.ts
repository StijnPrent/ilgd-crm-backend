/**
 * BonusAutomationService module.
 */
import { inject, injectable } from "tsyringe";
import { BonusService } from "./BonusService";
import { ICompanyRepository } from "../../data/interfaces/ICompanyRepository";
import { IChatterRepository } from "../../data/interfaces/IChatterRepository";
import { ChatterModel } from "../models/ChatterModel";

/**
 * Service responsible for triggering bonus rule evaluations on a schedule.
 */
@injectable()
export class BonusAutomationService {
    private timer: NodeJS.Timeout | undefined;
    private running = false;
    private readonly enabled: boolean;
    private readonly intervalMinutes: number;
    private readonly intervalMs: number;
    private readonly lookbackDays: number;

    constructor(
        @inject("BonusService") private bonusService: BonusService,
        @inject("ICompanyRepository") private companyRepo: ICompanyRepository,
        @inject("IChatterRepository") private chatterRepo: IChatterRepository,
    ) {
        this.intervalMinutes = this.resolveIntervalMinutes();
        this.intervalMs = this.intervalMinutes * 60_000;
        this.lookbackDays = this.resolveLookbackDays();
        this.enabled = this.shouldEnableAutomation();
    }

    /**
     * Starts the scheduled bonus evaluation loop if automation is enabled.
     */
    public start(): void {
        if (!this.enabled) {
            console.debug?.("[bonus] automation disabled");
            return;
        }
        if (this.timer) {
            return;
        }

        console.info(`[bonus] automation scheduled every ${this.intervalMinutes} minute(s)`);
        this.runScheduled();
        this.timer = setInterval(() => void this.runScheduled(), this.intervalMs);
    }

    private shouldEnableAutomation(): boolean {
        const raw = process.env.BONUS_AUTO_RUN_ENABLED;
        if (!raw) {
            return false;
        }
        const normalized = raw.trim().toLowerCase();
        return normalized !== "false" && normalized !== "0" && normalized !== "no";
    }

    private resolveIntervalMinutes(): number {
        const raw = Number(process.env.BONUS_AUTO_RUN_INTERVAL_MINUTES);
        if (!Number.isFinite(raw) || raw <= 0) {
            return 60 * 24; // default to once per day
        }
        return Math.floor(raw);
    }

    private async runScheduled(): Promise<void> {
        if (!this.enabled) {
            return;
        }
        if (this.running) {
            console.warn("[bonus] automation run skipped because a previous run is still in progress");
            return;
        }
        this.running = true;
        const asOf = new Date();
        let totalAwards = 0;

        try {
            const companies = await this.companyRepo.findAll();
            const chatters = await this.chatterRepo.findAll();
            const chattersByCompany = this.groupChattersByCompany(chatters);

            const anchors: Date[] = [];
            for (let d = 0; d <= this.lookbackDays; d++) {
                anchors.push(new Date(asOf.getTime() - d * 24 * 60 * 60 * 1000));
            }

            for (const company of companies) {
                const workers = chattersByCompany.get(company.id) ?? [];
                if (!workers.length) {
                    continue;
                }
                for (const worker of workers) {
                    for (const anchor of anchors) {
                        try {
                            const snapshots = await this.bonusService.runRules({
                                companyId: company.id,
                                workerId: worker.id,
                                asOf: anchor,
                            });
                            totalAwards += snapshots.length;
                        } catch (err) {
                            console.error(`[bonus] automation failed for company=${company.id} worker=${worker.id} asOf=${anchor.toISOString()}`, err);
                        }
                    }
                }
            }

            console.info(`[bonus] automation completed at ${asOf.toISOString()} (lookbackDays=${this.lookbackDays}, evaluated ${totalAwards} awards)`);
        } catch (err) {
            console.error("[bonus] automation failed", err);
        } finally {
            this.running = false;
        }
    }

    private resolveLookbackDays(): number {
        const raw = Number(process.env.BONUS_AUTO_RUN_LOOKBACK_DAYS);
        if (!Number.isFinite(raw) || raw < 0) {
            return 1; // run for today + yesterday by default to catch late data
        }
        return Math.floor(raw);
    }

    private groupChattersByCompany(chatters: ChatterModel[]): Map<number, ChatterModel[]> {
        const map = new Map<number, ChatterModel[]>();
        for (const chatter of chatters) {
            if (chatter.show === false) {
                continue;
            }
            const list = map.get(chatter.companyId) ?? [];
            list.push(chatter);
            map.set(chatter.companyId, list);
        }
        return map;
    }
}
