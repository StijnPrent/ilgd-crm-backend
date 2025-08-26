import {UserModel} from "../../business/models/UserModel";

export interface IUserRepository {
    findByEmail(email: string): Promise<UserModel | null>;
}