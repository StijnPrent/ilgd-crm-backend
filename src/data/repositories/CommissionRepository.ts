/**
 * CommissionRepository module.
 */
import { BaseRepository } from "./BaseRepository";
import { ICommissionRepository } from "../interfaces/ICommissionRepository";
import { CommissionModel } from "../../business/models/CommissionModel";
import { CommissionStatus } from "../../rename/types";
import { ResultSetHeader, RowDataPacket } from "mysql2";

/**
 * CommissionRepository class.
 */
export class CommissionRepository extends BaseRepository implements ICommissionRepository {
    private buildFilters(params: {
        chatterId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
    } = {}): { whereClause: string; values: any[] } {
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.chatterId !== undefined) {
            conditions.push("chatter_id = ?");
            values.push(params.chatterId);
        }
        if (params.date !== undefined) {
            conditions.push("DATE(commission_date) = ?");
            values.push(params.date.toISOString().slice(0, 10));
        }
        if (params.from !== undefined) {
            conditions.push("commission_date >= ?");
            values.push(params.from);
        }
        if (params.to !== undefined) {
            conditions.push("commission_date <= ?");
            values.push(params.to);
        }

        const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
        return { whereClause, values };
    }

    public async findAll(params: {
        limit?: number;
        offset?: number;
        chatterId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
    } = {}): Promise<CommissionModel[]> {
        const { whereClause, values } = this.buildFilters(params);
        let query = `SELECT id, chatter_id, shift_id, commission_date, earnings, commission_rate, commission, bonus, total_payout, status, created_at, updated_at FROM commissions${whereClause} ORDER BY commission_date DESC, created_at DESC`;
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
        return rows.map(CommissionModel.fromRow);
    }

    public async totalCount(params: {
        chatterId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
    } = {}): Promise<number> {
        const { whereClause, values } = this.buildFilters(params);
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM commissions${whereClause}`,
            values,
        );
        return rows.length ? Number(rows[0].total || 0) : 0;
    }

    public async findById(id: number): Promise<CommissionModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, shift_id, commission_date, earnings, commission_rate, commission, bonus, total_payout, status, created_at, updated_at FROM commissions WHERE id = ?",
            [id]
        );
        return rows.length ? CommissionModel.fromRow(rows[0]) : null;
    }

    public async findByShiftId(shiftId: number): Promise<CommissionModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, shift_id, commission_date, earnings, commission_rate, commission, bonus, total_payout, status, created_at, updated_at FROM commissions WHERE shift_id = ?",
            [shiftId]
        );
        return rows.length ? CommissionModel.fromRow(rows[0]) : null;
    }

    public async create(data: {
        chatterId: number;
        shiftId?: number | null;
        commissionDate: Date;
        earnings: number;
        commissionRate: number;
        commission: number;
        bonus?: number;
        totalPayout?: number;
        status: CommissionStatus;
    }): Promise<CommissionModel> {
        const bonus = data.bonus ?? 0;
        const totalPayout = data.totalPayout ?? data.commission + bonus;
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO commissions (chatter_id, shift_id, commission_date, earnings, commission_rate, commission, bonus, total_payout, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                data.chatterId,
                data.shiftId ?? null,
                data.commissionDate,
                data.earnings,
                data.commissionRate,
                data.commission,
                bonus,
                totalPayout,
                data.status,
            ]
        );
        const insertedId = Number(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created commission");
        return created;
    }

    public async update(id: number, data: {
        chatterId?: number;
        shiftId?: number | null;
        commissionDate?: Date;
        earnings?: number;
        commissionRate?: number;
        commission?: number;
        bonus?: number;
        totalPayout?: number;
        status?: CommissionStatus;
    }): Promise<CommissionModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        const bonus = data.bonus ?? existing.bonus;
        const shouldRecalculate = data.totalPayout === undefined && (data.commission !== undefined || data.bonus !== undefined);
        const totalPayout = data.totalPayout ?? (shouldRecalculate
            ? (data.commission ?? existing.commission) + (data.bonus ?? existing.bonus)
            : existing.totalPayout);
        await this.execute<ResultSetHeader>(
            "UPDATE commissions SET chatter_id = ?, shift_id = ?, commission_date = ?, earnings = ?, commission_rate = ?, commission = ?, bonus = ?, total_payout = ?, status = ? WHERE id = ?",
            [
                data.chatterId ?? existing.chatterId,
                data.shiftId !== undefined ? data.shiftId : existing.shiftId,
                data.commissionDate ?? existing.commissionDate,
                data.earnings ?? existing.earnings,
                data.commissionRate ?? existing.commissionRate,
                data.commission ?? existing.commission,
                bonus,
                totalPayout,
                data.status ?? existing.status,
                id,
            ]
        );
        return this.findById(id);
    }

    public async delete(id: number): Promise<void> {
        await this.execute<ResultSetHeader>(
            "DELETE FROM commissions WHERE id = ?",
            [id]
        );
    }
}
