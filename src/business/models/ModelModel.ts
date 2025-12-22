/**
 * ModelModel module.
 */

/**
 * ModelModel class.
 */
export class ModelModel {
    constructor(
        private _id: number,
        private _displayName: string,
        private _username: string,
        private _commissionRate: number,
        private _createdAt: Date,
        private _supportsBuyerRelationship: boolean = false,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            displayName: this.displayName,
            username: this.username,
            commissionRate: this.commissionRate,
            createdAt: this.createdAt,
            supportsBuyerRelationship: this._supportsBuyerRelationship,
        };
    }

    get id(): number { return this._id; }
    get displayName(): string { return this._displayName; }
    get username(): string { return this._username; }
    get commissionRate(): number { return this._commissionRate; }
    get createdAt(): Date { return this._createdAt; }
    get supportsBuyerRelationship(): boolean { return this._supportsBuyerRelationship; }

    public withSupportsBuyerRelationship(value: boolean): ModelModel {
        return new ModelModel(
            this.id,
            this.displayName,
            this.username,
            this.commissionRate,
            this.createdAt,
            value,
        );
    }

    static fromRow(r: any): ModelModel {
        return new ModelModel(
            Number(r.id),
            String(r.display_name),
            String(r.username),
            Number(r.commission_rate),
            r.created_at,
            false,
        );
    }
}
