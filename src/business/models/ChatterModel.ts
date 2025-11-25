/**
 * ChatterModel module.
 */
import { ChatterStatus, CurrencySymbol } from "../../rename/types";

/**
 * ChatterModel class.
 */
export class ChatterModel {
    constructor(
        private readonly _id: number,                 // FK to users.id
        private readonly _companyId: number,
        private readonly _email: string,
        private readonly _currency: CurrencySymbol,
        private readonly _commissionRate: number,     // percent
        private readonly _platformFee: number,        // percent
        private readonly _status: ChatterStatus,
        private readonly _createdAt: Date,
        private readonly _fullName?: string | null,
        private readonly _show?: boolean,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            companyId: this.companyId,
            email: this.email,
            currency: this.currency,
            commissionRate: this.commissionRate,
            platformFee: this.platformFee,
            status: this.status,
            fullName: this.fullName,
            show: this.show,
            createdAt: this.createdAt,
        };
    }

    // Getters
    get id(): number { return this._id; }
    get companyId(): number { return this._companyId; }
    get email(): string { return this._email; }
    get currency(): CurrencySymbol { return this._currency; }
    get commissionRate(): number { return this._commissionRate; }
    get platformFee(): number { return this._platformFee; }
    get status(): ChatterStatus { return this._status; }
    get createdAt(): Date { return this._createdAt; }
    get fullName(): string | null | undefined { return this._fullName; }
    get show(): boolean | undefined { return this._show; }

    static fromRow(row: any): ChatterModel {
        const fallbackCurrency = "EUR" as CurrencySymbol;
        return new ChatterModel(
            Number(row.id),
            Number(row.company_id ?? 0),
            String(row.email),
            (row.currency ?? fallbackCurrency) as CurrencySymbol,
            Number(row.commission_rate ?? 0),
            Number(row.platform_fee ?? 0),
            (row.status ?? "active") as ChatterStatus,
            row.created_at,
            row.full_name ?? null,
            row.is_visible === 1 ? true : row.is_visible === 0 ? false : undefined,
        );
    }
}
