/**
 * F2FTransactionSyncAutomationService module.
 */
import { injectable } from "tsyringe";
import { F2FTransactionSyncService } from "./F2FTransactionSyncService";

/**
 * Service responsible for triggering transaction syncs on a schedule.
 */
@injectable()
export class F2FTransactionSyncAutomationService {
    private timer: NodeJS.Timeout | undefined;
    private running = false;
    private readonly enabled: boolean;
    private readonly intervalMinutes: number;
    private readonly intervalMs: number;

    constructor(private txnSync: F2FTransactionSyncService) {
        this.intervalMinutes = this.resolveIntervalMinutes();
        this.intervalMs = this.intervalMinutes * 60_000;
        this.enabled = this.shouldEnableAutomation();
    }

    /**
     * Starts the scheduled transaction sync loop if automation is enabled.
     */
    public start(): void {
        if (!this.enabled) {
            console.debug?.("[f2f] auto sync disabled");
            return;
        }
        if (this.timer) {
            return;
        }

        console.info(`[f2f] auto sync scheduled every ${this.intervalMinutes} minute(s)`);
        this.runScheduled();
        this.timer = setInterval(() => void this.runScheduled(), this.intervalMs);
    }

    private shouldEnableAutomation(): boolean {
        const raw = process.env.F2F_AUTO_SYNC_ENABLED;
        if (!raw) {
            return false;
        }
        const normalized = raw.trim().toLowerCase();
        return normalized !== "false" && normalized !== "0" && normalized !== "no";
    }

    private resolveIntervalMinutes(): number {
        const raw = Number(process.env.F2F_AUTO_SYNC_INTERVAL_MINUTES);
        if (!Number.isFinite(raw) || raw <= 0) {
            return 60;
        }
        return Math.floor(raw);
    }

    private async runScheduled(): Promise<void> {
        if (!this.enabled) {
            return;
        }
        if (this.running) {
            console.warn("[f2f] auto sync skipped because a previous run is still in progress");
            return;
        }

        this.running = true;
        const started = new Date();
        try {
            const created = await this.txnSync.syncRecentTransactions();
            console.info(`[f2f] auto sync completed at ${started.toISOString()} (created=${created})`);
        } catch (err) {
            console.error("[f2f] auto sync failed", err);
        } finally {
            this.running = false;
        }
    }
}
