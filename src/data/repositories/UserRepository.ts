import {BaseRepository} from "./BaseRepository";
import {IUserRepository} from "../interfaces/IUserRepository";
import {UserModel} from "../../business/models/UserModel";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export class UserRepository extends BaseRepository implements IUserRepository {
    public async findByEmail(email: string): Promise<UserModel | null> {
        const query = `
            SELECT id, company_id, email, password_hash, role, created_at
            FROM users
            WHERE email = $1
        `;
        const result = await this.execute<RowDataPacket[]>(query, [email]);
        if (result.length === 0) {
            return null;
        }
        const row = result[0];
        return new UserModel(
            row.id,
            row.name,
            row.email,
            row.password
        );
    }
}