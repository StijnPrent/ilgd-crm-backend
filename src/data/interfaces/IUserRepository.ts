import {UserModel} from "../../business/models/UserModel";
import {Role} from "../../rename/types";

export interface IUserRepository {
    findAll(): Promise<UserModel[]>;
    findById(id: number): Promise<UserModel | null>;
    /** Finds a user by their email address. */
    findByEmail(email: string): Promise<UserModel | null>;
    create(data: {
        username: string;
        passwordHash: string;
        fullName: string;
        role: Role;
    }): Promise<UserModel>;
    update(id: number, data: {
        username?: string;
        passwordHash?: string;
        fullName?: string;
        role?: Role;
    }): Promise<UserModel | null>;
    delete(id: number): Promise<void>;
}