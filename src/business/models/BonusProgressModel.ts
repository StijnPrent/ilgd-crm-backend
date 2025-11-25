/**
 * BonusProgressModel module.
 */
export class BonusProgressModel {
    constructor(
        private readonly _id: number,
        private readonly _ruleId: number,
        private readonly _companyId: number,
        private readonly _workerId: number | null,
        private readonly _workerName: string | null,
        private readonly _lastObservedSteps: number,
        private readonly _lastComputedAt: Date,
        private readonly _createdAt: Date,
        private readonly _updatedAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            ruleId: this.ruleId,
            companyId: this.companyId,
            workerId: this.workerId,
            workerName: this.workerName,
            lastObservedSteps: this.lastObservedSteps,
            lastComputedAt: this.lastComputedAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    get id(): number { return this._id; }
    get ruleId(): number { return this._ruleId; }
    get companyId(): number { return this._companyId; }
    get workerId(): number | null { return this._workerId; }
    get workerName(): string | null { return this._workerName; }
    get lastObservedSteps(): number { return this._lastObservedSteps; }
    get lastComputedAt(): Date { return this._lastComputedAt; }
    get createdAt(): Date { return this._createdAt; }
    get updatedAt(): Date { return this._updatedAt; }

    static fromRow(row: any): BonusProgressModel {
        return new BonusProgressModel(
            Number(row.id),
            Number(row.rule_id),
            Number(row.company_id),
            row.worker_id != null ? Number(row.worker_id) : null,
            row.worker_name ?? null,
            Number(row.last_observed_steps ?? 0),
            row.last_computed_at,
            row.created_at,
            row.updated_at,
        );
    }
}
