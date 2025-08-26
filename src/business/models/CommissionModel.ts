import { CommissionStatus } from "../../rename/types";

export class CommissionModel {
    constructor(
        private _id: number,
        private _chatterId: number,
        private _periodStart: Date,
        private _periodEnd: Date,
        private _earnings: number,
        private _commissionRate: number,
        private _commission: number,
        private _status: CommissionStatus,
        private _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            chatterId: this.chatterId,
            periodStart: this.periodStart,
            periodEnd: this.periodEnd,
            earnings: this.earnings,
            commissionRate: this.commissionRate,
            commission: this.commission,
            status: this.status,
            createdAt: this.createdAt,
        };
    }

    // Getters
    get id(): number { return this._id; }
    get chatterId(): number { return this._chatterId; }
    get periodStart(): Date { return this._periodStart; }
    get periodEnd(): Date { return this._periodEnd; }
    get earnings(): number { return this._earnings; }
    get commissionRate(): number { return this._commissionRate; }
    get commission(): number { return this._commission; }
    get status(): CommissionStatus { return this._status; }
    get createdAt(): Date { return this._createdAt; }

    static fromRow(r: any): CommissionModel {
        return new CommissionModel(
            Number(r.id),
            Number(r.chatter_id),
            new Date(r.period_start),
            new Date(r.period_end),
            Number(r.earnings),
            Number(r.commission_rate),
            Number(r.commission),
            (r.status ?? "pending") as CommissionStatus,
            new Date(r.created_at),
        );
    }
}

