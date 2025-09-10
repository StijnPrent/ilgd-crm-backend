export class RevenueModel {
    constructor(
        private _id: string,
        private _amount: number,
        private _modelId: number | null,
        private _modelCommissionRate: number | null,
        private _chatterId: number | null,
        private _chatterCommissionRate: number | null,
        private _date: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            amount: this.amount,
            modelId: this.modelId,
            modelCommissionRate: this.modelCommissionRate,
            chatterId: this.chatterId,
            chatterCommissionRate: this.chatterCommissionRate,
            date: this.date,
        };
    }

    get id(): string { return this._id; }
    get amount(): number { return this._amount; }
    get modelId(): number | null { return this._modelId; }
    get modelCommissionRate(): number | null { return this._modelCommissionRate; }
    get chatterId(): number | null { return this._chatterId; }
    get chatterCommissionRate(): number | null { return this._chatterCommissionRate; }
    get date(): Date { return this._date; }

    static fromRow(row: any): RevenueModel {
        return new RevenueModel(
            row.id,
            row.amount,
            row.model_id,
            row.model_commission_rate,
            row.chatter_id,
            row.chatter_commission_rate,
            new Date(row.date),
        );
    }
}