/**
 * EmployeeEarningModel module.
 */

/**
 * EmployeeEarningModel class.
 */
export class EmployeeEarningModel {
    constructor(
        private _id: string,
        private _companyId: number,
        private _chatterId: number | null,
        private _modelId: number | null,
        private _shiftId: number | null,
        private _date: Date,           // business date
        private _amount: number,       // decimal(10,2)
        private _description: string | null,
        private _type: string | null,
        private _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            companyId: this.companyId,
            chatterId: this.chatterId,
            modelId: this.modelId,
            shiftId: this.shiftId,
            date: this.date,
            amount: this.amount,
            description: this.description,
            type: this.type,
            createdAt: this.createdAt,
        };
    }

    // Getters
    get id(): string { return this._id; }
    get companyId(): number { return this._companyId; }
    get chatterId(): number | null { return this._chatterId; }
    get modelId(): number | null { return this._modelId; }
    get shiftId(): number | null { return this._shiftId; }
    get date(): Date { return this._date; }
    get amount(): number { return this._amount; }
    get description(): string | null { return this._description; }
    get type(): string | null { return this._type; }
    get createdAt(): Date { return this._createdAt; }

    static fromRow(r: any): EmployeeEarningModel {
        return new EmployeeEarningModel(
            String(r.id),
            Number(r.company_id ?? 0),
            r.chatter_id != null ? Number(r.chatter_id) : null,
            r.model_id != null ? Number(r.model_id) : null,
            r.shift_id != null ? Number(r.shift_id) : null,
            r.date,
            Number(r.amount),
            r.description != null ? String(r.description) : null,
            r.type != null ? String(r.type) : null,
            r.created_at,
        );
    }
}
