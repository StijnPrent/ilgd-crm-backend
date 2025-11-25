/**
 * BonusAwardModel module.
 */
export class BonusAwardModel {
    constructor(
        private readonly _id: number,
        private readonly _ruleId: number,
        private readonly _companyId: number,
        private readonly _workerId: number | null,
        private readonly _stepsAwarded: number,
        private readonly _bonusAmountCents: number,
        private readonly _currency: string,
        private readonly _awardedAt: Date,
        private readonly _reason: string | null,
        private readonly _windowAnchor: string | null,
        private readonly _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            ruleId: this.ruleId,
            companyId: this.companyId,
            workerId: this.workerId,
            stepsAwarded: this.stepsAwarded,
            bonusAmountCents: this.bonusAmountCents,
            currency: this.currency,
            awardedAt: this.awardedAt,
            reason: this.reason,
            windowAnchor: this.windowAnchor,
            createdAt: this.createdAt,
        };
    }

    get id(): number { return this._id; }
    get ruleId(): number { return this._ruleId; }
    get companyId(): number { return this._companyId; }
    get workerId(): number | null { return this._workerId; }
    get stepsAwarded(): number { return this._stepsAwarded; }
    get bonusAmountCents(): number { return this._bonusAmountCents; }
    get currency(): string { return this._currency; }
    get awardedAt(): Date { return this._awardedAt; }
    get reason(): string | null { return this._reason; }
    get windowAnchor(): string | null { return this._windowAnchor; }
    get createdAt(): Date { return this._createdAt; }

    static fromRow(row: any): BonusAwardModel {
        return new BonusAwardModel(
            Number(row.id),
            Number(row.rule_id),
            Number(row.company_id),
            row.worker_id != null ? Number(row.worker_id) : null,
            Number(row.steps_awarded ?? 0),
            Number(row.bonus_amount_cents ?? 0),
            String(row.currency ?? "USD"),
            row.awarded_at,
            row.reason != null ? String(row.reason) : null,
            row.window_anchor != null ? String(row.window_anchor) : null,
            row.created_at ?? row.awarded_at,
        );
    }
}
