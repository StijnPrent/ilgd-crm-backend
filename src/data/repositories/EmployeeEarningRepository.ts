import {BaseRepository} from "./BaseRepository";
import {IEmployeeEarningRepository} from "../interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";
import {ResultSetHeader, RowDataPacket} from "mysql2";

export class EmployeeEarningRepository extends BaseRepository implements IEmployeeEarningRepository {
    public async findAll(): Promise<EmployeeEarningModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, date, amount, description, created_at FROM employee_earnings",
            []
        );
        return rows.map(EmployeeEarningModel.fromRow);
    }

    public async findById(id: string): Promise<EmployeeEarningModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, date, amount, description, created_at FROM employee_earnings WHERE id = ?",
            [id]
        );
        return rows.length ? EmployeeEarningModel.fromRow(rows[0]) : null;
    }

    public async create(data: { id?: string; chatterId: number; date: Date; amount: number; description?: string | null; }): Promise<EmployeeEarningModel> {
        if (data.id) {
            await this.execute<ResultSetHeader>(
                "INSERT INTO employee_earnings (id, chatter_id, date, amount, description) VALUES (?, ?, ?, ?, ?)",
                [data.id, data.chatterId, data.date, data.amount, data.description ?? null]
            );
            const created = await this.findById(data.id);
            if (!created) throw new Error("Failed to fetch created earning");
            return created;
        }

        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO employee_earnings (chatter_id, date, amount, description) VALUES (?, ?, ?, ?)",
            [data.chatterId, data.date, data.amount, data.description ?? null]
        );
        const insertedId = String(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created earning");
        return created;
    }

    public async update(id: string, data: { chatterId?: number; date?: Date; amount?: number; description?: string | null; }): Promise<EmployeeEarningModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE employee_earnings SET chatter_id = ?, date = ?, amount = ?, description = ? WHERE id = ?",
            [
                data.chatterId ?? existing.chatterId,
                data.date ?? existing.date,
                data.amount ?? existing.amount,
                data.description ?? existing.description,
                id
            ]
        );
        return this.findById(id);
    }

    public async delete(id: string): Promise<void> {
        await this.execute<ResultSetHeader>(
            "DELETE FROM employee_earnings WHERE id = ?",
            [id]
        );
    }

    public async getLastId(): Promise<string | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id FROM employee_earnings WHERE description LIKE 'F2F%' ORDER BY created_at DESC LIMIT 1",
            []
        );
        return rows.length ? String(rows[0].id) : null;
    }
}
