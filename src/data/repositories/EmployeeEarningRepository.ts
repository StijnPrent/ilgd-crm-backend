/**
 * EmployeeEarningRepository module.
 */
import {BaseRepository} from "./BaseRepository";
import {IEmployeeEarningRepository} from "../interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {RevenueModel} from "../../business/models/RevenueModel";

/**
 * EmployeeEarningRepository class.
 */
export class EmployeeEarningRepository extends BaseRepository implements IEmployeeEarningRepository {
    public async findAll(params: {
        limit?: number;
        offset?: number;
        chatterId?: number;
        types?: string[];
        date?: Date;
        from?: Date;
        to?: Date;
        shiftId?: number;
        modelId?: number;
    } = {}): Promise<EmployeeEarningModel[]> {
        const baseQuery = "FROM employee_earnings ee";
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.chatterId !== undefined) {
            conditions.push("ee.chatter_id = ?");
            values.push(params.chatterId);
        }
        if (params.modelId !== undefined) {              // <-- add
            conditions.push("ee.model_id = ?");
            values.push(params.modelId);
        }
        if (params.types && params.types.length) {
            const placeholders = params.types.map(() => "?").join(", ");
            conditions.push(`ee.type IN (${placeholders})`);
            values.push(...params.types);
        }
        if (params.date !== undefined) {
            conditions.push("DATE(ee.date) = ?");
            values.push(params.date.toISOString().slice(0, 10));
        }
        if (params.from !== undefined) {
            conditions.push("ee.date >= ?");
            values.push(params.from);
        }
        if (params.to !== undefined) {
            conditions.push("ee.date <= ?");
            values.push(params.to);
        }
        if (params.shiftId !== undefined) {
            conditions.push(
                `EXISTS (
                    SELECT 1
                    FROM shifts s
                    LEFT JOIN shift_models sm ON sm.shift_id = s.id
                    WHERE s.id = ?
                      AND ee.date BETWEEN s.start_time AND COALESCE(s.end_time, NOW())
                      AND (
                          (ee.model_id IS NOT NULL AND sm.model_id = ee.model_id)
                          OR (ee.model_id IS NULL AND ee.chatter_id = s.chatter_id)
                      )
                )`
            );
            values.push(params.shiftId);
        }

        const whereClause = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

        let query = `SELECT ee.id, ee.chatter_id, ee.model_id, ee.shift_id, ee.date, ee.amount, ee.description, ee.type, ee.created_at ${baseQuery}${whereClause} ORDER BY ee.date DESC`;
        const dataValues = [...values];
        if (params.limit !== undefined) {
            query += " LIMIT ?";
            dataValues.push(params.limit);
            if (params.offset !== undefined) {
                query += " OFFSET ?";
                dataValues.push(params.offset);
            }
        } else if (params.offset !== undefined) {
            query += " LIMIT 18446744073709551615 OFFSET ?";
            dataValues.push(params.offset);
        }

        const rows = await this.execute<RowDataPacket[]>(query, dataValues);
        return rows.map(EmployeeEarningModel.fromRow);
    }

    public async totalCount(params: {
        chatterId?: number;
        types?: string[];
        modelId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
        shiftId?: number;
    } = {}): Promise<number> {
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.chatterId !== undefined) {
            conditions.push("chatter_id = ?");
            values.push(params.chatterId);
        }
        if (params.types && params.types.length) {
            const placeholders = params.types.map(() => "?").join(", ");
            conditions.push(`type IN (${placeholders})`);
            values.push(...params.types);
        }
        if (params.modelId !== undefined) {
            conditions.push("model_id = ?");
            values.push(params.modelId);
        }
        if (params.date !== undefined) {
            conditions.push("DATE(date) = ?");
            values.push(params.date.toISOString().slice(0, 10));
        }
        if (params.from !== undefined) {
            conditions.push("date >= ?");
            values.push(params.from);
        }
        if (params.to !== undefined) {
            conditions.push("date <= ?");
            values.push(params.to);
        }
        if (params.shiftId !== undefined) {
            conditions.push(
                `EXISTS (
                    SELECT 1
                    FROM shifts s
                    LEFT JOIN shift_models sm ON sm.shift_id = s.id
                    WHERE s.id = ?
                      AND employee_earnings.date BETWEEN s.start_time AND COALESCE(s.end_time, NOW())
                      AND (
                          (employee_earnings.model_id IS NOT NULL AND sm.model_id = employee_earnings.model_id)
                          OR (employee_earnings.model_id IS NULL AND employee_earnings.chatter_id = s.chatter_id)
                      )
                )`
            );
            values.push(params.shiftId);
        }

        const whereClause = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM employee_earnings${whereClause}`,
            values
        );
        return Number(rows[0].total || 0);
    }

    public async findById(id: string): Promise<EmployeeEarningModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, model_id, shift_id, date, amount, description, type, created_at FROM employee_earnings WHERE id = ?",
            [id]
        );
        return rows.length ? EmployeeEarningModel.fromRow(rows[0]) : null;
    }

    public async create(data: {
        id?: string;
        chatterId: number | null;
        modelId: number | null;
        shiftId?: number | null;
        date: Date;
        amount: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel> {
        if (data.id) {
            await this.execute<ResultSetHeader>(
                "INSERT INTO employee_earnings (id, chatter_id, model_id, shift_id, date, amount, description, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [data.id, data.chatterId ?? null, data.modelId ?? null, data.shiftId ?? null, data.date, data.amount, data.description ?? null, data.type ?? null]
            );
            const created = await this.findById(data.id);
            if (!created) throw new Error("Failed to fetch created earning");
            return created;
        }

        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO employee_earnings (chatter_id, model_id, shift_id, date, amount, description, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [data.chatterId ?? null, data.modelId ?? null, data.shiftId ?? null, data.date, data.amount, data.description ?? null, data.type ?? null]
        );
        const insertedId = String(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created earning");
        return created;
    }

    public async update(id: string, data: {
        chatterId?: number | null;
        modelId?: number | null;
        shiftId?: number | null;
        date?: Date;
        amount?: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE employee_earnings SET chatter_id = ?, model_id = ?, shift_id = ?, date = ?, amount = ?, description = ?, type = ? WHERE id = ?",
            [
                data.chatterId !== undefined ? data.chatterId : existing.chatterId,
                data.modelId !== undefined ? data.modelId : existing.modelId,
                data.shiftId !== undefined ? data.shiftId : existing.shiftId,
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
            "SELECT id, chatter_id, model_id, shift_id, date, amount, description, type, created_at FROM employee_earnings WHERE chatter_id = ? ORDER BY date DESC",
            [chatterId]
        );
        return rows.map(EmployeeEarningModel.fromRow);
    }

    public async getLeaderboard(params: {
        startOfWeek: Date;
        startOfMonth: Date;
        from?: Date;
        to?: Date;
    }): Promise<{
        chatterId: number;
        chatterName: string;
        weekAmount: number;
        monthAmount: number;
    }[]> {
        const joinConditions = ["ee.chatter_id = c.id"];
        const rangeValues: any[] = [];
        if (params.from !== undefined) {
            joinConditions.push("ee.date >= ?");
            rangeValues.push(params.from);
        }
        if (params.to !== undefined) {
            joinConditions.push("ee.date <= ?");
            rangeValues.push(params.to);
        }

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT
                 c.id AS chatter_id,
                 u.full_name,
                 SUM(CASE WHEN ee.date >= ? THEN ee.amount ELSE 0 END) AS week_amount,
                 SUM(CASE WHEN ee.date >= ? THEN ee.amount ELSE 0 END) AS month_amount
             FROM chatters c
                      JOIN users u ON u.id = c.id
                      LEFT JOIN employee_earnings ee ON ${joinConditions.join(" AND ")}
             WHERE c.show = 1
             GROUP BY c.id, u.full_name
             ORDER BY month_amount DESC
                 LIMIT 3`,
            [params.startOfWeek, params.startOfMonth, ...rangeValues]
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
            `SELECT id, chatter_id, model_id, shift_id, date, amount, description, type, created_at
     FROM employee_earnings
     WHERE chatter_id IS NULL
       AND model_id IS NOT NULL
       AND type IN ('paypermessage','tip')
       AND date BETWEEN ? AND ?
     ORDER BY date ASC`,
            [start, end]
        );
        return rows.map(EmployeeEarningModel.fromRow);
    }


    public async findAllWithCommissionRates(params: {from?: Date; to?: Date;} = {}): Promise<RevenueModel[]> {
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.from !== undefined) {
            conditions.push("ee.date >= ?");
            values.push(params.from);
        }
        if (params.to !== undefined) {
            conditions.push("ee.date <= ?");
            values.push(params.to);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT ee.id,
                    ee.amount,
                    ee.model_id,
                    m.commission_rate AS model_commission_rate,
                    ee.chatter_id,
                    c.commission_rate AS chatter_commission_rate,
                    c.platform_fee,
                    ee.date
             FROM employee_earnings ee
                      LEFT JOIN models m ON ee.model_id = m.id
                      LEFT JOIN chatters c ON ee.chatter_id = c.id
             ${whereClause}
             ORDER BY ee.date DESC`,
            values
        );
        return rows.map(RevenueModel.fromRow);
    }

    public async getTotalAmount(params: {from?: Date; to?: Date;} = {}): Promise<number> {
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.from !== undefined) {
            conditions.push("date >= ?");
            values.push(params.from);
        }
        if (params.to !== undefined) {
            conditions.push("date <= ?");
            values.push(params.to);
        }

        const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM employee_earnings${whereClause}`,
            values
        );

        return Number(rows[0]?.total ?? 0);
    }
}

