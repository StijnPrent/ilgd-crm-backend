/**
 * ShiftModel module.
 */
import {ShiftStatus} from "../../rename/types";
import { ShiftBuyerRelationship } from "../../rename/types";

/**
 * ShiftModel class.
 */
export class ShiftModel {
    constructor(
        private _id: number,
        private _companyId: number,
        private _chatterId: number,
        private _modelIds: number[],
        private _date: Date,         // business date (UTC midnight)
        private _startTime: Date,    // UTC datetime
        private _endTime: Date | null,      // UTC datetime
        private _status: ShiftStatus,
        private _recurringGroupId: string | null,
        private _createdAt: Date,
        private _modelBuyerRelationships: Map<number, ShiftBuyerRelationship | null> = new Map(),
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            companyId: this.companyId,
            chatterId: this.chatterId,
            modelIds: this.modelIds,
            date: this.date.toISOString(),
            startTime: this.startTime.toISOString(),
            endTime: this.endTime ? this.endTime.toISOString() : null,
            status: this.status,
            recurringGroupId: this.recurringGroupId,
            createdAt: this.createdAt.toISOString(),
            modelBuyerRelationships: Object.fromEntries(this._modelBuyerRelationships),
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
    get recurringGroupId(): string | null { return this._recurringGroupId; }
    get createdAt(): Date { return this._createdAt; }
    get modelBuyerRelationships(): Map<number, ShiftBuyerRelationship | null> { return this._modelBuyerRelationships; }
    public getBuyerRelationshipForModel(modelId: number): ShiftBuyerRelationship | null | undefined {
        return this._modelBuyerRelationships.get(modelId) ?? null;
    }

    private static parseUtc(value: any): Date {
        if (value instanceof Date) return value;
        let str = String(value).trim().replace(" ", "T");
        if (!str.includes("T")) {
            str = `${str}T00:00:00Z`;
        } else if (!str.endsWith("Z")) {
            str = `${str}Z`;
        }
        return new Date(str);
    }

    static fromRow(r: any): ShiftModel {
        const ids = typeof r.model_ids === 'string'
            ? r.model_ids.split(',').map((v: string) => Number(v)).filter((n: number) => !Number.isNaN(n))
            : [];
        const modelRelationships = new Map<number, ShiftBuyerRelationship | null>();
        if (typeof r.model_relationships === "string" && r.model_relationships.trim()) {
            const parts = String(r.model_relationships).split(",");
            for (const part of parts) {
                const [idStr, relRaw = ""] = part.split(":");
                const mid = Number(idStr);
                const rel = relRaw.trim();
                if (!Number.isFinite(mid)) continue;
                if (rel === "fan" || rel === "follower" || rel === "both") {
                    modelRelationships.set(mid, rel as ShiftBuyerRelationship);
                } else {
                    modelRelationships.set(mid, null);
                }
            }
        }

        return new ShiftModel(
            Number(r.id),
            Number(r.company_id),
            Number(r.chatter_id),
            ids,
            ShiftModel.parseUtc(r.date),
            ShiftModel.parseUtc(r.start_time),
            r.end_time != null ? ShiftModel.parseUtc(r.end_time) : null,
            r.status as ShiftStatus,
            r.recurring_group_id ?? null,
            ShiftModel.parseUtc(r.created_at),
            modelRelationships,
        );
    }
}
