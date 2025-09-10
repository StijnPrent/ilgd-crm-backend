import {BaseRepository} from "./BaseRepository";
import {IEmployeeEarningRepository} from "../interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {RevenueModel} from "../../business/models/RevenueModel";

export class EmployeeEarningRepository extends BaseRepository implements IEmployeeEarningRepository {
    public async findAll(params: {
        limit?: number;
        offset?: number;
        chatterId?: number;
        type?: string;
    } = {}): Promise<EmployeeEarningModel[]> {
        let query = "SELECT id, chatter_id, model_id, date, amount, description, type, created_at FROM employee_earnings";
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.chatterId !== undefined) {
            conditions.push("chatter_id = ?");
            values.push(params.chatterId);
        }
        if (params.type !== undefined) {
            conditions.push("type = ?");
            values.push(params.type);
        }

        if (conditions.length) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY date DESC";

        if (params.limit !== undefined) {
            query += " LIMIT ?";
            values.push(params.limit);
            if (params.offset !== undefined) {
                query += " OFFSET ?";
                values.push(params.offset);
            }
        } else if (params.offset !== undefined) {
            query += " LIMIT 18446744073709551615 OFFSET ?";
            values.push(params.offset);
        }

        const rows = await this.execute<RowDataPacket[]>(query, values);
        return rows.map(EmployeeEarningModel.fromRow);
    }

    public async findById(id: string): Promise<EmployeeEarningModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, model_id, date, amount, description, type, created_at FROM employee_earnings WHERE id = ?",
            [id]
        );
        return rows.length ? EmployeeEarningModel.fromRow(rows[0]) : null;
    }

    public async create(data: {
        id?: string;
        chatterId: number | null;
        modelId: number | null;
        date: Date;
        amount: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel> {
        if (data.id) {
            await this.execute<ResultSetHeader>(
                "INSERT INTO employee_earnings (id, chatter_id, model_id, date, amount, description, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [data.id, data.chatterId ?? null, data.modelId ?? null, data.date, data.amount, data.description ?? null, data.type ?? null]
            );
            const created = await this.findById(data.id);
            if (!created) throw new Error("Failed to fetch created earning");
            return created;
        }

        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO employee_earnings (chatter_id, model_id, date, amount, description, type) VALUES (?, ?, ?, ?, ?, ?)",
            [data.chatterId ?? null, data.modelId ?? null, data.date, data.amount, data.description ?? null, data.type ?? null]
        );
        const insertedId = String(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created earning");
        return created;
    }

    public async update(id: string, data: {
        chatterId?: number | null;
        modelId?: number | null;
        date?: Date;
        amount?: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE employee_earnings SET chatter_id = ?, model_id = ?, date = ?, amount = ?, description = ?, type = ? WHERE id = ?",
            [
                data.chatterId !== undefined ? data.chatterId : existing.chatterId,
                data.modelId !== undefined ? data.modelId : existing.modelId,
                data.date ?? existing.date,
                data.amount ?? existing.amount,
                data.description ?? existing.description,
                data.type ?? existing.type,
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

    public async findByChatter(chatterId: number): Promise<EmployeeEarningModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, model_id, date, amount, description, type, created_at FROM employee_earnings WHERE chatter_id = ? ORDER BY date DESC",
            [chatterId]
        );
        return rows.map(EmployeeEarningModel.fromRow);
    }

    public async getLeaderboard(startOfWeek: Date, startOfMonth: Date): Promise<{
        chatterId: number;
        chatterName: string;
        weekAmount: number;
        monthAmount: number;
    }[]> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT c.id                                                  AS                                                  chatter_id,
                    u.full_name,
                    SUM(CASE WHEN ee.date >= ? THEN ee.amount ELSE 0 END) AS week_amount,
                    SUM(CASE WHEN ee.date >= ? THEN ee.amount ELSE 0 END) AS month_amount
             FROM chatters c
                      JOIN users u ON u.id = c.id
                      LEFT JOIN employee_earnings ee ON ee.chatter_id = c.id
             GROUP BY c.id, u.full_name`,
            [startOfWeek, startOfMonth]
        );
        return rows.map(r => ({
            chatterId: Number(r.chatter_id),
            chatterName: String(r.full_name),
            weekAmount: Number(r.week_amount || 0),
            monthAmount: Number(r.month_amount || 0),
        }));
    }

    public async findWithoutChatterBetween(start: Date, end: Date): Promise<EmployeeEarningModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, model_id, date, amount, description, type, created_at FROM employee_earnings WHERE chatter_id IS NULL AND model_id IS NOT NULL AND date BETWEEN ? AND ? ORDER BY date ASC",
            [start, end]
        );
        return rows.map(EmployeeEarningModel.fromRow);
    }

    public async findAllWithCommissionRates(): Promise<RevenueModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT ee.id,
                    ee.amount,
                    ee.model_id,
                    m.commission_rate AS model_commission_rate,
                    ee.chatter_id,
                    c.commission_rate AS chatter_commission_rate,
                    ee.date
             FROM employee_earnings ee
                      LEFT JOIN models m ON ee.model_id = m.id
                      LEFT JOIN chatters c ON ee.chatter_id = c.id
             ORDER BY ee.date DESC`,
            []
        );
        return rows.map(RevenueModel.fromRow);
    }
}

