/**
 * Shared bonus rule type definitions.
 */

export type BonusScope = "worker";

export type BonusWindowType = "calendar_day" | "calendar_month";

export type BonusRuleType = "threshold_payout";

export interface BaseBonusRuleConfig {
    metric: string;
    includeRefunds?: boolean;
    // When true and window is calendar_day, compute totals over
    // the worker's shifts for that business date (not strict UTC day).
    // Ignored for non-daily windows.
    shiftBased?: boolean;
}

export interface ThresholdTier {
    minAmountCents: number; // inclusive threshold
    bonusCents: number;     // flat payout when threshold reached
}

export interface ThresholdPayoutRuleConfig extends BaseBonusRuleConfig {
    metric: "earnings.amount_cents";
    tiers: ThresholdTier[];
    // When true, pay at most once per window (default true)
    awardOncePerWindow?: boolean;
}

export type BonusRuleConfig = ThresholdPayoutRuleConfig;

export interface BonusRuleEvaluationContext {
    totalCents: number;
    lastObservedSteps: number;
}

export interface BonusRuleEvaluationResult {
    stepsNow: number;
    stepsToAward: number;
    expectedAwardCents: number;
    reason: string;
}

export interface BonusWindowBounds {
    windowStart: Date;
    windowEnd: Date;
}
