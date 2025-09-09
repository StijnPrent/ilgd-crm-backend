import {ShiftStatus} from "../../rename/types";
import {toLocalDateString, toLocalISOString} from "../../utils/time";

export class ShiftModel {
    constructor(
        private _id: number,
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
            chatterId: this.chatterId,
            modelIds: this.modelIds,
            date: toLocalDateString(this.date),
            startTime: toLocalISOString(this.startTime),
            endTime: this.endTime ? toLocalISOString(this.endTime) : null,
            status: this.status,
            createdAt: toLocalISOString(this.createdAt),
        };
    }

    // Getters
    get id(): number { return this._id; }
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
            Number(r.chatter_id),
            ids,
            new Date(r.date),
            new Date(r.start_time),
            r.end_time ? new Date(r.end_time) : null,
            r.status as ShiftStatus,
            new Date(r.created_at),
        );
    }
}
