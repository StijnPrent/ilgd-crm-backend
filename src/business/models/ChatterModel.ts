import {ChatterStatus, CurrencySymbol} from "../../rename/types";
import {toLocalISOString} from "../../utils/time";

export class ChatterModel {
    constructor(
        private _id: number,                 // FK to users.id
        private _email: string,
        private _currency: CurrencySymbol,
        private _commissionRate: number,     // percent
        private _platformFee: number,        // percent
        private _status: ChatterStatus,
        private _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            email: this.email,
            currency: this.currency,
            commissionRate: this.commissionRate,
            platformFee: this.platformFee,
            status: this.status,
            createdAt: toLocalISOString(this.createdAt),
        };
    }

    // Getters
    get id(): number { return this._id; }
    get email(): string { return this._email; }
    get currency(): CurrencySymbol { return this._currency; }
    get commissionRate(): number { return this._commissionRate; }
    get platformFee(): number { return this._platformFee; }
    get status(): ChatterStatus { return this._status; }
    get createdAt(): Date { return this._createdAt; }

    static fromRow(r: any): ChatterModel {
        return new ChatterModel(
            Number(r.id),
            String(r.email),
            (r.currency ?? "€") as CurrencySymbol,
            Number(r.commission_rate ?? 0),
            Number(r.platform_fee ?? 0),
            (r.status ?? "active") as ChatterStatus,
            new Date(r.created_at),
        );
    }
}
