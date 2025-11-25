/**
 * IUserRepository module.
 */
import {UserModel} from "../../business/models/UserModel";
import {Role} from "../../rename/types";

/**
 * IUserRepository interface.
 */
export interface IUserRepository {
    findAll(): Promise<UserModel[]>;
    findById(id: number): Promise<UserModel | null>;
    /** Finds a user by their username. */
    findByUsername(username: string): Promise<UserModel | null>;
    create(data: {
        companyId: number;
        username: string;
        passwordHash: string;
        fullName: string;
        role: Role;
    }): Promise<UserModel>;
    update(id: number, data: {
        companyId?: number;
        username?: string;
        passwordHash?: string;
        fullName?: string;
        role?: Role;
    }): Promise<UserModel | null>;
    delete(id: number): Promise<void>;
}
