/**
 * BonusEvaluationService module.
 */
import { inject, injectable } from "tsyringe";
import pool from "../../config/database";
import {
    BonusRuleEvaluationResult,
    BonusWindowBounds,
    BonusScope,
    BonusRuleConfig,
} from "../bonus/BonusTypes";
import { ThresholdPayoutEvaluator } from "../bonus/ThresholdPayoutEvaluator";
import { BonusAwardConflictError } from "../bonus/BonusErrors";
import { IEmployeeEarningRepository } from "../../data/interfaces/IEmployeeEarningRepository";
import { IBonusRuleRepository } from "../../data/interfaces/IBonusRuleRepository";
import { IBonusProgressRepository } from "../../data/interfaces/IBonusProgressRepository";
import { IBonusAwardRepository } from "../../data/interfaces/IBonusAwardRepository";
import { BonusRuleModel } from "../models/BonusRuleModel";
import { BonusAwardModel } from "../models/BonusAwardModel";
import { IChatterRepository } from "../../data/interfaces/IChatterRepository";

export interface BonusEvaluationTarget {
    companyId: number;
    workerId?: number | null;
}

export interface BonusEvaluationSnapshot {
    ruleId: number;
    companyId: number;
    workerId: number | null;
    totalCents: number;
    stepsNow: number;
    lastObservedSteps: number;
    delta: number;
    stepsAwarded: number;
    expectedAwardCents: number;
    currency: string;
    windowStart: Date;
    windowEnd: Date;
    reason: string;
    award?: BonusAwardModel;
}

export interface EvaluateOptions {
    asOf?: Date;
    dryRun?: boolean;
}

const DEFAULT_CURRENCY = "EUR";

/**
 * Service orchestrating bonus rule evaluations.
 */
@injectable()
export class BonusEvaluationService {
    private readonly evaluator = new ThresholdPayoutEvaluator();

    constructor(
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        @inject("IBonusRuleRepository") private ruleRepo: IBonusRuleRepository,
        @inject("IBonusProgressRepository") private progressRepo: IBonusProgressRepository,
        @inject("IBonusAwardRepository") private awardRepo: IBonusAwardRepository,
        @inject("IChatterRepository") private chatterRepo: IChatterRepository,
    ) {}

    public async evaluateRule(
        rule: BonusRuleModel,
        target: BonusEvaluationTarget,
        options: EvaluateOptions = {},
    ): Promise<BonusEvaluationSnapshot> {
        const asOf = options.asOf ?? new Date();
        const window = this.resolveWindow(rule, asOf);
        const useShiftBased = (rule.ruleConfig as any)?.shiftBased === true && rule.windowType === "calendar_day";
        let totalCents: number;
        if (useShiftBased && rule.scope === "worker" && target.workerId != null) {
            // Sum earnings across all shifts for the business date
            totalCents = await this.earningRepo.sumAmountForWorkerShiftsOnDate({
                companyId: target.companyId,
                workerId: target.workerId,
                businessDate: window.windowStart,
                includeRefunds: this.shouldIncludeRefunds(rule.ruleConfig),
            });
        } else {
            totalCents = await this.earningRepo.sumAmountForWindow({
                companyId: target.companyId,
                from: window.windowStart,
                to: window.windowEnd,
                workerId: rule.scope === "worker" ? (target.workerId ?? null) : null,
                includeRefunds: this.shouldIncludeRefunds(rule.ruleConfig),
            });
        }

        const workerId = this.resolveWorkerId(rule.scope, target.workerId);
        const currency = await this.resolveCurrency(rule, workerId ?? undefined);

        if (options.dryRun) {
            const progress = await this.progressRepo.get(
                rule.id,
                target.companyId,
                workerId,
            );
            const lastObserved = progress?.lastObservedSteps ?? 0;
            const evaluation = this.evaluateRuleConfig(rule.ruleConfig, {
                totalCents,
                lastObservedSteps: lastObserved,
            });
            return this.buildSnapshot(rule, target, window, totalCents, lastObserved, evaluation, currency);
        }

        return this.evaluateWithTransaction(rule, target, window, totalCents, asOf, currency);
    }

    public async evaluateActiveRulesForTarget(
        companyId: number,
        scope?: BonusScope,
        targetWorkerId?: number | null,
        options: EvaluateOptions = {},
    ): Promise<BonusEvaluationSnapshot[]> {
        const rules = await this.ruleRepo.findActiveByCompany(companyId);
        const relevant = rules.filter(rule => rule.scope === "worker");

        const snapshots: BonusEvaluationSnapshot[] = [];
        for (const rule of relevant) {
            const snapshot = await this.evaluateRule(rule, { companyId, workerId: targetWorkerId }, options);
            snapshots.push(snapshot);
        }
        return snapshots;
    }

    private async evaluateWithTransaction(
        rule: BonusRuleModel,
        target: BonusEvaluationTarget,
        window: BonusWindowBounds,
        totalCents: number,
        asOf: Date,
        resolvedCurrency: string,
    ): Promise<BonusEvaluationSnapshot> {
        const workerId = this.resolveWorkerId(rule.scope, target.workerId);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const progress = await this.progressRepo.get(
                rule.id,
                target.companyId,
                workerId,
                { connection, forUpdate: true },
            );
            const lastObserved = progress?.lastObservedSteps ?? 0;
            const evaluation = this.evaluateRuleConfig(rule.ruleConfig, {
                totalCents,
                lastObservedSteps: lastObserved,
            });

            let award: BonusAwardModel | undefined;

            if (evaluation.stepsToAward > 0 && evaluation.expectedAwardCents > 0) {
                const currency = resolvedCurrency;
                try {
                    award = await this.awardRepo.create({
                        ruleId: rule.id,
                        companyId: target.companyId,
                        workerId,
                        stepsAwarded: evaluation.stepsToAward,
                        bonusAmountCents: evaluation.expectedAwardCents,
                        currency,
                        awardedAt: asOf,
                        reason: evaluation.reason,
                        windowAnchor: this.buildWindowAnchor(window),
                    }, connection);
                } catch (err: any) {
                    if (err?.code === "ER_DUP_ENTRY") {
                        throw new BonusAwardConflictError("Duplicate bonus award detected");
                    }
                    throw err;
                }

                await this.progressRepo.upsert({
                    ruleId: rule.id,
                    companyId: target.companyId,
                    workerId,
                    lastObservedSteps: lastObserved + evaluation.stepsToAward,
                    lastComputedAt: asOf,
                }, connection);
            } else {
                await this.progressRepo.upsert({
                    ruleId: rule.id,
                    companyId: target.companyId,
                    workerId,
                    lastObservedSteps: lastObserved,
                    lastComputedAt: asOf,
                }, connection);
            }

            await connection.commit();
            const currency = award?.currency ?? resolvedCurrency;
            return this.buildSnapshot(
                rule,
                target,
                window,
                totalCents,
                lastObserved,
                evaluation,
                currency,
                award,
            );
        } catch (err) {
            await connection.rollback();
            if (err instanceof BonusAwardConflictError) {
                console.warn(`[bonus] Duplicate award prevented for rule ${rule.id}, worker ${target.workerId}`);
                return {
                    ruleId: rule.id,
                    companyId: target.companyId,
                    workerId: workerId ?? null,
                    totalCents,
                    stepsNow: 0,
                    lastObservedSteps: 0,
                    delta: 0,
                    stepsAwarded: 0,
                    expectedAwardCents: 0,
                    currency: resolvedCurrency,
                    windowStart: window.windowStart,
                    windowEnd: window.windowEnd,
                    reason: "Duplicate award prevented",
                };
            }
            throw err;
        } finally {
            connection.release();
        }
    }

    private evaluateRuleConfig(
        config: BonusRuleConfig,
        context: { totalCents: number; lastObservedSteps: number },
    ): BonusRuleEvaluationResult {
        return this.evaluator.evaluate(config as any, context);
    }

    private resolveWindow(rule: BonusRuleModel, asOf: Date): BonusWindowBounds {
        if (rule.windowType === "calendar_day") {
            const windowEnd = new Date(Date.UTC(
                asOf.getUTCFullYear(),
                asOf.getUTCMonth(),
                asOf.getUTCDate(),
                23, 59, 59, 999,
            ));
            const windowStart = new Date(Date.UTC(
                asOf.getUTCFullYear(),
                asOf.getUTCMonth(),
                asOf.getUTCDate(),
                0, 0, 0, 0,
            ));
            return { windowStart, windowEnd };
        }
        if (rule.windowType === "calendar_month") {
            const year = asOf.getUTCFullYear();
            const month = asOf.getUTCMonth();
            const windowStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
            const windowEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            return { windowStart, windowEnd };
        }
        throw new Error(`Unsupported window type ${rule.windowType}`);
    }

    private shouldIncludeRefunds(config: BonusRuleConfig): boolean {
        return Boolean((config as any).includeRefunds);
    }

    private resolveWorkerId(scope: BonusScope, workerId?: number | null): number | null {
        if (scope === "worker") {
            return workerId ?? null;
        }
        return null;
    }

    private buildWindowAnchor(window: BonusWindowBounds): string {
        return `${Math.floor(window.windowStart.getTime() / 1000)}-${Math.floor(window.windowEnd.getTime() / 1000)}`;
    }

    private async resolveCurrency(rule: BonusRuleModel, workerId?: number): Promise<string> {
        const cfg = rule.ruleConfig as any;
        if (Array.isArray(cfg.currencies) && cfg.currencies.length === 1) {
            return String(cfg.currencies[0]);
        }

        if (workerId != null) {
            try {
                const chatter = await this.chatterRepo.findById(workerId);
                if (chatter?.currency) {
                    return chatter.currency;
                }
            } catch (err) {
                console.warn(`[bonus] Failed to resolve chatter currency for worker ${workerId}`, err);
            }
        }
        return DEFAULT_CURRENCY;
    }

    // simplified: single evaluator only

    private buildSnapshot(
        rule: BonusRuleModel,
        target: BonusEvaluationTarget,
        window: BonusWindowBounds,
        totalCents: number,
        lastObservedSteps: number,
        evaluation: BonusRuleEvaluationResult,
        currency: string,
        award?: BonusAwardModel,
    ): BonusEvaluationSnapshot {
        const workerId = this.resolveWorkerId(rule.scope, target.workerId);
        return {
            ruleId: rule.id,
            companyId: target.companyId,
            workerId: workerId ?? null,
            totalCents,
            stepsNow: evaluation.stepsNow,
            lastObservedSteps,
            delta: evaluation.stepsNow - lastObservedSteps,
            stepsAwarded: evaluation.stepsToAward,
            expectedAwardCents: evaluation.expectedAwardCents,
            currency,
            windowStart: window.windowStart,
            windowEnd: window.windowEnd,
            reason: evaluation.reason,
            award,
        };
    }
}
