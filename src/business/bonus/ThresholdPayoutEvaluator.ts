/**
 * threshold_payout evaluator.
 */
import {
    BonusRuleEvaluationContext,
    BonusRuleEvaluationResult,
    BonusRuleType,
    ThresholdPayoutRuleConfig,
    ThresholdTier,
} from "./BonusTypes";

export interface BonusRuleEvaluatorLike {
    readonly type: BonusRuleType;
    evaluate(
        config: ThresholdPayoutRuleConfig,
        context: BonusRuleEvaluationContext,
    ): BonusRuleEvaluationResult;
}

function selectTier(tiers: ThresholdTier[], totalCents: number): ThresholdTier | null {
    if (!tiers.length) return null;
    let best: ThresholdTier | null = null;
    for (const t of tiers) {
        if (t.minAmountCents <= totalCents) {
            if (!best || t.minAmountCents > best.minAmountCents) {
                best = t;
            }
        }
    }
    return best;
}

/**
 * Evaluator for a simple threshold-based payout: grant a flat bonus
 * when total earnings meet a configured threshold for the window.
 */
export class ThresholdPayoutEvaluator implements BonusRuleEvaluatorLike {
    public readonly type: BonusRuleType = "threshold_payout";

    public evaluate(
        config: ThresholdPayoutRuleConfig,
        context: BonusRuleEvaluationContext,
    ): BonusRuleEvaluationResult {
        const { totalCents, lastObservedSteps } = context;
        const tiers = Array.isArray(config.tiers) ? [...config.tiers] : [];

        if (!tiers.length) {
            return {
                stepsNow: 0,
                stepsToAward: 0,
                expectedAwardCents: 0,
                reason: "No tiers configured",
            };
        }

        // Determine the best-matching tier by minAmountCents.
        const tier = selectTier(tiers, totalCents);
        if (!tier) {
            return {
                stepsNow: 0,
                stepsToAward: 0,
                expectedAwardCents: 0,
                reason: `Total ${totalCents} below lowest threshold`,
            };
        }

        // We model this as a single step that can be awarded at most once per window.
        const stepsNow = 1;
        const alreadyAwarded = lastObservedSteps >= stepsNow;
        const stepsToAward = alreadyAwarded ? 0 : 1;
        const expectedAwardCents = stepsToAward > 0 ? tier.bonusCents : 0;

        return {
            stepsNow,
            stepsToAward,
            expectedAwardCents,
            reason: alreadyAwarded
                ? `Threshold met (>= ${tier.minAmountCents}) but already awarded`
                : `Threshold met (>= ${tier.minAmountCents}); awarding ${tier.bonusCents}`,
        };
    }
}

