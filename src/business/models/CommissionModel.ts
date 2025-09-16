/**
 * CommissionModel module.
 */
import { CommissionStatus } from "../../rename/types";

/**
 * CommissionModel class.
 */
export class CommissionModel {
    constructor(
        private _id: number,
        private _chatterId: number,
        private _shiftId: number | null,
        private _commissionDate: Date,
        private _earnings: number,
        private _commissionRate: number,
        private _commission: number,
        private _bonus: number,
        private _totalPayout: number,
        private _status: CommissionStatus,
        private _createdAt: Date,
        private _updatedAt: Date | null,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            chatterId: this.chatterId,
            shiftId: this.shiftId,
            commissionDate: this.commissionDate,
            earnings: this.earnings,
            commissionRate: this.commissionRate,
            commission: this.commission,
            bonus: this.bonus,
            totalPayout: this.totalPayout,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    // Getters
    get id(): number { return this._id; }
    get chatterId(): number { return this._chatterId; }
    get shiftId(): number | null { return this._shiftId; }
    get commissionDate(): Date { return this._commissionDate; }
    get earnings(): number { return this._earnings; }
    get commissionRate(): number { return this._commissionRate; }
    get commission(): number { return this._commission; }
    get bonus(): number { return this._bonus; }
    get totalPayout(): number { return this._totalPayout; }
    get status(): CommissionStatus { return this._status; }
    get createdAt(): Date { return this._createdAt; }
    get updatedAt(): Date | null { return this._updatedAt; }

    static fromRow(r: any): CommissionModel {
        return new CommissionModel(
            Number(r.id),
            Number(r.chatter_id),
            r.shift_id != null ? Number(r.shift_id) : null,
            r.commission_date ?? r.period_start ?? r.period_end ?? r.created_at,
            Number(r.earnings),
            Number(r.commission_rate),
            Number(r.commission),
            Number(r.bonus ?? 0),
            Number(r.total_payout ?? Number(r.commission ?? 0) + Number(r.bonus ?? 0)),
            (r.status ?? "pending") as CommissionStatus,
            r.created_at,
            r.updated_at ?? null,
        );
    }
}

