/**
 * CompanyModel module.
 */
export class CompanyModel {
    constructor(
        private readonly _id: number,
        private readonly _name: string,
        private readonly _slug: string | null,
        private readonly _currency: string | null,
        private readonly _timezone: string | null,
        private readonly _createdAt: Date,
        private readonly _updatedAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            name: this.name,
            slug: this.slug,
            currency: this.currency,
            timezone: this.timezone,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    get id(): number { return this._id; }
    get name(): string { return this._name; }
    get slug(): string | null { return this._slug; }
    get currency(): string | null { return this._currency; }
    get timezone(): string | null { return this._timezone; }
    get createdAt(): Date { return this._createdAt; }
    get updatedAt(): Date { return this._updatedAt; }

    static fromRow(row: any): CompanyModel {
        return new CompanyModel(
            Number(row.id),
            String(row.name),
            row.slug != null ? String(row.slug) : null,
            row.currency != null ? String(row.currency) : null,
            row.timezone != null ? String(row.timezone) : null,
            row.created_at,
            row.updated_at,
        );
    }
}
