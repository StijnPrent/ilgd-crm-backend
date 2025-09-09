
export class ModelModel {
    constructor(
        private _id: number,
        private _displayName: string,
        private _username: string,
        private _commissionRate: number,
        private _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            displayName: this.displayName,
            username: this.username,
            commissionRate: this.commissionRate,
            createdAt: this.createdAt,
        };
    }

    get id(): number { return this._id; }
    get displayName(): string { return this._displayName; }
    get username(): string { return this._username; }
    get commissionRate(): number { return this._commissionRate; }
    get createdAt(): Date { return this._createdAt; }

    static fromRow(r: any): ModelModel {
        return new ModelModel(
            Number(r.id),
            String(r.display_name),
            String(r.username),
            Number(r.commission_rate),
            r.created_at,
        );
    }
}
