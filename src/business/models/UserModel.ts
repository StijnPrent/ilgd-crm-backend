/**
 * UserModel module.
 */
import {Role} from "../../rename/types";

/**
 * UserModel class.
 */
export class UserModel {
    constructor(
        private _id: number,
        private _username: string,
        private _passwordHash: string,
        private _fullName: string,
        private _role: Role,
        private _createdAt: Date,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            id: this.id,
            username: this.username,
            fullName: this.fullName,
            role: this.role,
            createdAt: this.createdAt,
        };
    }

    // Getters
    get id(): number { return this._id; }
    get username(): string { return this._username; }
    get passwordHash(): string { return this._passwordHash; } // don't expose in toJSON
    get fullName(): string { return this._fullName; }
    get role(): Role { return this._role; }
    get createdAt(): Date { return this._createdAt; }

    // Helpers (optional)
    static fromRow(r: any): UserModel {
        return new UserModel(
            Number(r.id),
            String(r.username),
            String(r.password_hash),
            String(r.full_name),
            r.role as Role,
            r.created_at,
        );
    }
}
