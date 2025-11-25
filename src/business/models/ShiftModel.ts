/**
 * ShiftModel module.
 */
import {ShiftStatus} from "../../rename/types";

/**
 * ShiftModel class.
 */
export class ShiftModel {
    constructor(
        private _id: number,
        private _companyId: number,
        private _chatterId: number,
        private _modelIds: number[],
        private _date: Date,         // business date
        private _startTime: Date,    // datetime
        private _endTime: Date | null,      // datetime
        private _status: ShiftStatus,
        private _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            companyId: this.companyId,
            chatterId: this.chatterId,
            modelIds: this.modelIds,
            date: this.date,
            startTime: this.startTime,
            endTime: this.endTime,
            status: this.status,
            createdAt: this.createdAt,
        };
    }

    // Getters
    get id(): number { return this._id; }
    get companyId(): number { return this._companyId; }
    get chatterId(): number { return this._chatterId; }
    get modelIds(): number[] { return this._modelIds; }
    get date(): Date { return this._date; }
    get startTime(): Date { return this._startTime; }
    get endTime(): Date | null { return this._endTime; }
    get status(): ShiftStatus { return this._status; }
    get createdAt(): Date { return this._createdAt; }

    static fromRow(r: any): ShiftModel {
        const ids = typeof r.model_ids === 'string'
            ? r.model_ids.split(',').map((v: string) => Number(v)).filter((n: number) => !Number.isNaN(n))
            : [];
        return new ShiftModel(
            Number(r.id),
            Number(r.company_id),
            Number(r.chatter_id),
            ids,
            r.date,
            r.start_time,
            r.end_time,
            r.status as ShiftStatus,
            r.created_at,
        );
    }
}
