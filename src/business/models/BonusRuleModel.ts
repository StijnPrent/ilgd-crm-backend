/**
 * BonusRuleModel module.
 */
import {
    BonusRuleConfig,
    BonusRuleType,
    BonusScope,
    BonusWindowType,
    ThresholdPayoutRuleConfig,
} from "../bonus/BonusTypes";

export type RuleConfigInput = BonusRuleConfig | Record<string, unknown>;

const DEFAULT_METRIC = "earnings.amount_cents";

function parseConfig(raw: any, type: BonusRuleType): BonusRuleConfig {
    if (!raw || typeof raw !== "object") {
        throw new Error("Invalid ruleConfig payload");
    }
    if (type === "threshold_payout") {
        const cfg = raw as Partial<ThresholdPayoutRuleConfig> as any;
        const tiers = Array.isArray(cfg.tiers) ? cfg.tiers.map((t: any) => ({
            minAmountCents: Number(t?.minAmountCents ?? 0),
            bonusCents: Number(t?.bonusCents ?? 0),
        })) : [];
        return {
            metric: DEFAULT_METRIC,
            tiers,
            includeRefunds: cfg.includeRefunds ?? false,
            shiftBased: cfg.shiftBased ?? false,
            awardOncePerWindow: cfg.awardOncePerWindow ?? true,
        } as ThresholdPayoutRuleConfig;
    }
    throw new Error(`Unknown rule type: ${type}`);
}

/**
 * BonusRuleModel class.
 */
export class BonusRuleModel {
    constructor(
        private readonly _id: number,
        private readonly _companyId: number,
        private readonly _name: string,
        private readonly _isActive: boolean,
        private readonly _priority: number,
        private readonly _scope: BonusScope,
        private readonly _windowType: BonusWindowType,
        private readonly _windowSeconds: number | null,
        private readonly _ruleType: BonusRuleType,
        private readonly _ruleConfig: BonusRuleConfig,
        private readonly _createdAt: Date,
        private readonly _updatedAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            companyId: this.companyId,
            name: this.name,
            isActive: this.isActive,
            priority: this.priority,
            scope: this.scope,
            windowType: this.windowType,
            windowSeconds: this.windowSeconds,
            ruleType: this.ruleType,
            ruleConfig: this.ruleConfig,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    get id(): number { return this._id; }
    get companyId(): number { return this._companyId; }
    get name(): string { return this._name; }
    get isActive(): boolean { return this._isActive; }
    get priority(): number { return this._priority; }
    get scope(): BonusScope { return this._scope; }
    get windowType(): BonusWindowType { return this._windowType; }
    get windowSeconds(): number | null { return this._windowSeconds; }
    get ruleType(): BonusRuleType { return this._ruleType; }
    get ruleConfig(): BonusRuleConfig { return this._ruleConfig; }
    get createdAt(): Date { return this._createdAt; }
    get updatedAt(): Date { return this._updatedAt; }

    static fromRow(row: any): BonusRuleModel {
        const type = String(row.rule_type) as BonusRuleType;
        const config = parseConfig(deserializeConfig(row.rule_config), type);

        return new BonusRuleModel(
            Number(row.id),
            Number(row.company_id),
            String(row.name),
            Boolean(row.is_active),
            Number(row.priority ?? 0),
            String(row.scope) as BonusScope,
            String(row.window_type) as BonusWindowType,
            row.window_seconds != null ? Number(row.window_seconds) : null,
            type,
            config,
            row.created_at,
            row.updated_at,
        );
    }
}

function deserializeConfig(raw: unknown): any {
    if (raw == null) {
        return {};
    }
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.error("Failed to parse bonus rule config JSON", err);
            return {};
        }
    }
    return raw;
}
