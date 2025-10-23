/**
 * ShiftRequestModel module.
 */
import {ShiftRequestStatus, ShiftRequestType} from "../../rename/types";

export interface ShiftSummary {
    id: number;
    date: Date | string;
    startTime: Date | string;
    endTime: Date | string | null;
}

export interface ChatterSummary {
    id: number;
    name: string | null;
    fullName: string | null;
}

/**
 * ShiftRequestModel class.
 */
export class ShiftRequestModel {
    constructor(
        private _id: number,
        private _shiftId: number,
        private _chatterId: number,
        private _type: ShiftRequestType,
        private _status: ShiftRequestStatus,
        private _note: string | null,
        private _managerNote: string | null,
        private _createdAt: Date,
        private _updatedAt: Date,
        private _resolvedAt: Date | null,
        private _shift: ShiftSummary,
        private _chatter: ChatterSummary,
    ) {}

    public toJSON(): Record<string, unknown> {
        const chatterDisplayName = this.chatter.fullName
            ?? this.chatter.name
            ?? `Chatter ${this.chatter.id}`;

        return {
            id: this.id,
            shiftId: this.shiftId,
            chatterId: this.chatterId,
            type: this.type,
            status: this.status,
            note: this.note,
            managerNote: this.managerNote,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            resolvedAt: this.resolvedAt,
            shift: this.shift,
            chatter: {
                id: this.chatter.id,
                name: this.chatter.name ?? chatterDisplayName,
                fullName: chatterDisplayName,
                full_name: chatterDisplayName,
            },
            chatterName: chatterDisplayName,
        };
    }

    get id(): number { return this._id; }
    get shiftId(): number { return this._shiftId; }
    get chatterId(): number { return this._chatterId; }
    get type(): ShiftRequestType { return this._type; }
    get status(): ShiftRequestStatus { return this._status; }
    get note(): string | null { return this._note; }
    get managerNote(): string | null { return this._managerNote; }
    get createdAt(): Date { return this._createdAt; }
    get updatedAt(): Date { return this._updatedAt; }
    get resolvedAt(): Date | null { return this._resolvedAt; }
    get shift(): ShiftSummary { return this._shift; }
    get chatter(): ChatterSummary { return this._chatter; }

    static fromRow(row: any): ShiftRequestModel {
        return new ShiftRequestModel(
            Number(row.id),
            Number(row.shift_id),
            Number(row.chatter_id),
            row.type as ShiftRequestType,
            row.status as ShiftRequestStatus,
            row.note ?? null,
            row.manager_note ?? null,
            row.created_at,
            row.updated_at,
            row.resolved_at ?? null,
            {
                id: Number(row.shift_id),
                date: row.shift_date,
                startTime: row.shift_start_time,
                endTime: row.shift_end_time ?? null,
            },
            (() => {
                const rawChatterName = typeof row.chatter_name === "string" ? row.chatter_name : null;
                const trimmedChatterName = rawChatterName?.trim() ?? null;
                return {
                    id: Number(row.chatter_id),
                    name: trimmedChatterName,
                    fullName: trimmedChatterName,
                };
            })(),
        );
    }
}
