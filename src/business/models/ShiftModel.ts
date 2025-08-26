import {ShiftStatus} from "../../rename/types";

export class ShiftModel {
    constructor(
        private _id: number,
        private _chatterId: number,
        private _date: Date,         // business date
        private _startTime: Date,    // datetime
        private _endTime: Date,      // datetime
        private _status: ShiftStatus,
        private _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            chatterId: this.chatterId,
            date: this.date,
            startTime: this.startTime,
            endTime: this.endTime,
            status: this.status,
            createdAt: this.createdAt,
        };
    }

    // Getters
    get id(): number { return this._id; }
    get chatterId(): number { return this._chatterId; }
    get date(): Date { return this._date; }
    get startTime(): Date { return this._startTime; }
    get endTime(): Date { return this._endTime; }
    get status(): ShiftStatus { return this._status; }
    get createdAt(): Date { return this._createdAt; }

    static fromRow(r: any): ShiftModel {
        return new ShiftModel(
            Number(r.id),
            Number(r.chatter_id),
            new Date(r.date),
            new Date(r.start_time),
            new Date(r.end_time),
            r.status as ShiftStatus,
            new Date(r.created_at),
        );
    }
}
