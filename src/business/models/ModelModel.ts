export class ModelModel {
    constructor(
        private _id: number,
        private _username: string,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            username: this.username,
        };
    }

    get id(): number { return this._id; }
    get username(): string { return this._username; }

    static fromRow(r: any): ModelModel {
        return new ModelModel(
            Number(r.id),
            String(r.username),
        );
    }
}
