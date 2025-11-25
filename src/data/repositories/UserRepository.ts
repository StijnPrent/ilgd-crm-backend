/**
 * UserRepository module.
 */
import {BaseRepository} from "./BaseRepository";
import {IUserRepository} from "../interfaces/IUserRepository";
import {UserModel} from "../../business/models/UserModel";
import {Role} from "../../rename/types";
import {ResultSetHeader, RowDataPacket} from "mysql2";

/**
 * UserRepository class.
 */
export class UserRepository extends BaseRepository implements IUserRepository {
    public async findAll(): Promise<UserModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, company_id, username, password_hash, full_name, role, created_at FROM users",
            []
        );
        return rows.map(UserModel.fromRow);
    }

    public async findById(id: number): Promise<UserModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, company_id, username, password_hash, full_name, role, created_at FROM users WHERE id = ?",
            [id]
        );
        return rows.length ? UserModel.fromRow(rows[0]) : null;
    }

    public async findByUsername(username: string): Promise<UserModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, company_id, username, password_hash, full_name, role, created_at FROM users WHERE username = ?",
            [username]
        );
        return rows.length ? UserModel.fromRow(rows[0]) : null;
    }

    public async create(data: { companyId: number; username: string; passwordHash: string; fullName: string; role: Role; }): Promise<UserModel> {
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO users (company_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)",
            [data.companyId, data.username, data.passwordHash, data.fullName, data.role]
        );
        const insertedId = Number(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created user");
        return created;
    }

    public async update(id: number, data: { companyId?: number; username?: string; passwordHash?: string; fullName?: string; role?: Role; }): Promise<UserModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE users SET company_id = ?, username = ?, password_hash = ?, full_name = ?, role = ? WHERE id = ?",
            [
                data.companyId ?? existing.companyId,
                data.username ?? existing.username,
                data.passwordHash ?? existing.passwordHash,
                data.fullName ?? existing.fullName,
                data.role ?? existing.role,
                id
            ]
        );
        return this.findById(id);
    }

    public async delete(id: number): Promise<void> {
        await this.execute<ResultSetHeader>(
            "DELETE FROM users WHERE id = ?",
            [id]
        );
    }
}
