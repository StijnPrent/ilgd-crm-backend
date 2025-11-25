/**
 * BonusService module.
 */
import { inject, injectable } from "tsyringe";
import { IBonusRuleRepository, BonusRuleCreateInput, BonusRuleUpdateInput } from "../../data/interfaces/IBonusRuleRepository";
import { IBonusAwardRepository, BonusAwardQuery } from "../../data/interfaces/IBonusAwardRepository";
import { IBonusProgressRepository } from "../../data/interfaces/IBonusProgressRepository";
import { BonusRuleModel } from "../models/BonusRuleModel";
import { BonusAwardModel } from "../models/BonusAwardModel";
import { BonusProgressModel } from "../models/BonusProgressModel";
import { BonusEvaluationService, BonusEvaluationSnapshot } from "./BonusEvaluationService";
import { BonusValidationError } from "../bonus/BonusErrors";
import { BonusRuleConfig, ThresholdPayoutRuleConfig, ThresholdTier } from "../bonus/BonusTypes";

export interface BonusRuleFilter {
    companyId?: number;
    isActive?: boolean;
    scope?: "worker";
}

export interface BonusRuleInput {
    companyId: number;
    name: string;
    isActive: boolean;
    priority: number;
    scope: "worker";
    windowType: "calendar_day" | "calendar_month";
    windowSeconds: null;
    ruleType: "threshold_payout";
    ruleConfig: any;
}

export interface BonusRuleUpdatePayload extends Partial<Omit<BonusRuleInput, "companyId">> {
    ruleConfig?: any;
}

export interface BonusRunInput {
    companyId: number;
    workerId?: number | null;
    ruleId?: number;
    asOf?: Date;
}

export interface BonusPreviewInput {
    companyId: number;
    workerId?: number | null;
    asOf?: Date;
}

export interface BonusShiftRunInput {
    companyId: number;
    workerId: number;
    asOf: Date;
}

export interface BonusAwardsResponse {
    awards: BonusAwardModel[];
    totals: {
        count: number;
        totalCents: number;
    };
}

@injectable()
export class BonusService {
    constructor(
        @inject("IBonusRuleRepository") private ruleRepo: IBonusRuleRepository,
        @inject("IBonusAwardRepository") private awardRepo: IBonusAwardRepository,
        @inject("IBonusProgressRepository") private progressRepo: IBonusProgressRepository,
        @inject("BonusEvaluationService") private evaluationService: BonusEvaluationService,
    ) {}

    public async listRules(filter: BonusRuleFilter = {}): Promise<BonusRuleModel[]> {
        return this.ruleRepo.findAll(filter);
    }

    public async createRule(payload: BonusRuleInput): Promise<BonusRuleModel> {
        this.assertCompanyId(payload.companyId);
        const config = this.normalizeRuleConfig(payload.ruleConfig);
        this.validateWindowConfig(payload.windowType);

        const data: BonusRuleCreateInput = {
            companyId: payload.companyId,
            name: payload.name,
            isActive: payload.isActive,
            priority: payload.priority,
            scope: "worker",
            windowType: payload.windowType,
            windowSeconds: null,
            ruleType: "threshold_payout",
            ruleConfig: config,
        };
        return this.ruleRepo.create(data);
    }

    public async updateRule(ruleId: number, payload: BonusRuleUpdatePayload): Promise<BonusRuleModel | null> {
        const existing = await this.ruleRepo.findById(ruleId);
        if (!existing) {
            return null;
        }

        const config = payload.ruleConfig !== undefined
            ? this.normalizeRuleConfig(payload.ruleConfig)
            : undefined;

        if (payload.windowType) {
            const windowType = payload.windowType ?? existing.windowType;
            this.validateWindowConfig(windowType);
        }

        const data: BonusRuleUpdateInput = {
            name: payload.name,
            isActive: payload.isActive,
            priority: payload.priority,
            scope: payload.scope as any,
            windowType: payload.windowType,
            windowSeconds: null,
            ruleType: "threshold_payout",
            ruleConfig: config,
        };
        return this.ruleRepo.update(ruleId, data);
    }

    public async getRule(ruleId: number): Promise<BonusRuleModel | null> {
        return this.ruleRepo.findById(ruleId);
    }

    public async previewRule(ruleId: number, input: BonusPreviewInput): Promise<BonusEvaluationSnapshot> {
        const rule = await this.ruleRepo.findById(ruleId);
        if (!rule) {
            throw new BonusValidationError("Rule not found");
        }
        if (rule.companyId !== input.companyId) {
            throw new BonusValidationError("Rule does not belong to the specified company");
        }
        return this.evaluationService.evaluateRule(
            rule,
            { companyId: input.companyId, workerId: input.workerId ?? null },
            { asOf: input.asOf ?? new Date(), dryRun: true },
        );
    }

    public async runRules(input: BonusRunInput): Promise<BonusEvaluationSnapshot[]> {
        this.assertCompanyId(input.companyId);

        if (input.ruleId) {
            const rule = await this.ruleRepo.findById(input.ruleId);
            if (!rule) {
                throw new BonusValidationError("Rule not found");
            }
            if (rule.companyId !== input.companyId) {
                throw new BonusValidationError("Rule does not belong to the specified company");
            }
            return [
                await this.evaluationService.evaluateRule(
                    rule,
                    { companyId: input.companyId, workerId: input.workerId ?? null },
                    { asOf: input.asOf ?? new Date() },
                ),
            ];
        }

        const snapshots: BonusEvaluationSnapshot[] = [];
        const asOf = input.asOf ?? new Date();

        if (input.workerId != null) {
            const workerRuns = await this.evaluationService.evaluateActiveRulesForTarget(
                input.companyId,
                "worker",
                input.workerId,
                { asOf },
            );
            snapshots.push(...workerRuns);
        }

        // simplified: no company-scope bonuses

        return snapshots;
    }

    public async runShiftScopedRules(input: BonusShiftRunInput): Promise<BonusEvaluationSnapshot[]> {
        this.assertCompanyId(input.companyId);
        if (!input.workerId) {
            throw new BonusValidationError("workerId is required for shift bonuses");
        }

        const rules = await this.ruleRepo.findActiveByCompany(input.companyId);
        const shiftRules = rules.filter(rule =>
            rule.scope === "worker" &&
            rule.windowType === "calendar_day" &&
            this.isShiftScoped(rule),
        );

        const snapshots: BonusEvaluationSnapshot[] = [];
        for (const rule of shiftRules) {
            const snapshot = await this.evaluationService.evaluateRule(
                rule,
                { companyId: input.companyId, workerId: input.workerId },
                { asOf: input.asOf },
            );
            snapshots.push(snapshot);
        }

        return snapshots;
    }

    public async listAwards(params: BonusAwardQuery): Promise<BonusAwardsResponse> {
        if (!params.companyId) {
            throw new BonusValidationError("companyId is required");
        }
        const [awards, totals] = await Promise.all([
            this.awardRepo.list(params),
            this.awardRepo.totals(params),
        ]);
        return { awards, totals };
    }

    public async listProgress(params: { companyId: number; workerId?: number }): Promise<BonusProgressModel[]> {
        if (!params.companyId) {
            throw new BonusValidationError("companyId is required");
        }
        return this.progressRepo.list(params);
    }

    private normalizeRuleConfig(raw: any): BonusRuleConfig {
        return this.normalizeThresholdPayoutConfig(raw);
    }

    private isShiftScoped(rule: BonusRuleModel): boolean {
        const config = rule.ruleConfig as any;
        return Boolean(config?.shiftBased);
    }

    // per-step config removed in simplified rules

    private normalizeThresholdPayoutConfig(raw: any): ThresholdPayoutRuleConfig {
        if (!raw || typeof raw !== "object") {
            throw new BonusValidationError("ruleConfig must be an object");
        }
        const tiersRaw = Array.isArray((raw as any).tiers) ? (raw as any).tiers : [];
        const tiers: ThresholdTier[] = [];
        for (const t of tiersRaw) {
            const min = Number((t as any).minAmountCents);
            const bonus = Number((t as any).bonusCents);
            if (!Number.isFinite(min) || min < 0) {
                throw new BonusValidationError("tiers[].minAmountCents must be a non-negative number");
            }
            if (!Number.isFinite(bonus) || bonus <= 0) {
                throw new BonusValidationError("tiers[].bonusCents must be a positive number");
            }
            tiers.push({ minAmountCents: Math.floor(min), bonusCents: Math.floor(bonus) });
        }
        if (!tiers.length) {
            throw new BonusValidationError("At least one tier is required");
        }

        // Sort tiers ascending by min
        tiers.sort((a, b) => a.minAmountCents - b.minAmountCents);

        const includeRefunds = Boolean((raw as any).includeRefunds);
        const shiftBased = Boolean((raw as any).shiftBased);
        const awardOncePerWindow = (raw as any).awardOncePerWindow !== undefined
            ? Boolean((raw as any).awardOncePerWindow)
            : true;
        const metric = (raw as any).metric ?? "earnings.amount_cents";
        if (metric !== "earnings.amount_cents") {
            throw new BonusValidationError("metric must be 'earnings.amount_cents'");
        }

        return {
            metric: "earnings.amount_cents",
            tiers,
            includeRefunds,
            shiftBased,
            awardOncePerWindow,
        };
    }

    private validateWindowConfig(windowType: string): void {
        if (windowType !== "calendar_day" && windowType !== "calendar_month") {
            throw new BonusValidationError("windowType must be 'calendar_day' or 'calendar_month'");
        }
    }

    private assertCompanyId(companyId?: number): void {
        if (!companyId || Number.isNaN(companyId)) {
            throw new BonusValidationError("companyId is required");
        }
    }
}
