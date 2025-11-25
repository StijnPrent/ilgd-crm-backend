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
        companyId?: number;
        chatterId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
    } = {}): { whereClause: string; values: any[] } {
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.companyId !== undefined) {
            conditions.push("company_id = ?");
            values.push(params.companyId);
        }
        if (params.chatterId !== undefined) {
            conditions.push("chatter_id = ?");
            values.push(params.chatterId);
        }
        if (params.date !== undefined) {
            conditions.push("DATE(commission_date) = ?");
            values.push(this.formatDate(params.date));
        }
        if (params.from !== undefined) {
            conditions.push("DATE(commission_date) >= ?");
            values.push(this.formatDate(params.from));
        }
        if (params.to !== undefined) {
            conditions.push("DATE(commission_date) <= ?");
            values.push(this.formatDate(params.to));
        }

        const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
        return { whereClause, values };
    }

    private formatDate(value: Date): string {
        return value.toISOString().slice(0, 10);
    }

    public async findAll(params: {
        limit?: number;
        offset?: number;
        companyId?: number;
        chatterId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
    } = {}): Promise<CommissionModel[]> {
        const { whereClause, values } = this.buildFilters(params);
        let query = `SELECT id, company_id, chatter_id, shift_id, commission_date, earnings, commission_rate, commission, total_payout, status, created_at, updated_at FROM commissions${whereClause} ORDER BY commission_date DESC, created_at DESC`;
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
        companyId?: number;
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

    public async findById(id: number, companyId?: number): Promise<CommissionModel | null> {
        const companyClause = companyId !== undefined ? " AND company_id = ?" : "";
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, company_id, chatter_id, shift_id, commission_date, earnings, commission_rate, commission, total_payout, status, created_at, updated_at FROM commissions WHERE id = ?${companyClause}`,
            companyId !== undefined ? [id, companyId] : [id],
        );
        return rows.length ? CommissionModel.fromRow(rows[0]) : null;
    }

    public async findByShiftId(shiftId: number, companyId?: number): Promise<CommissionModel | null> {
        const companyClause = companyId !== undefined ? " AND company_id = ?" : "";
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, company_id, chatter_id, shift_id, commission_date, earnings, commission_rate, commission, total_payout, status, created_at, updated_at FROM commissions WHERE shift_id = ?${companyClause}`,
            companyId !== undefined ? [shiftId, companyId] : [shiftId]
        );
        return rows.length ? CommissionModel.fromRow(rows[0]) : null;
    }

    public async findClosestByChatterIdAndDate(chatterId: number, date: Date, companyId?: number): Promise<CommissionModel | null> {
        const companyClause = companyId !== undefined ? " AND company_id = ?" : "";
        const values: any[] = [chatterId];
        if (companyId !== undefined) {
            values.push(companyId);
        }
        values.push(date);

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, company_id, chatter_id, shift_id, commission_date, earnings, commission_rate, commission, total_payout, status, created_at, updated_at
             FROM commissions
             WHERE chatter_id = ?${companyClause}
             ORDER BY ABS(TIMESTAMPDIFF(SECOND, commission_date, ?)), commission_date ASC
             LIMIT 1`,
            values,
        );

        return rows.length ? CommissionModel.fromRow(rows[0]) : null;
    }

    public async create(data: {
        chatterId: number;
        companyId: number;
        shiftId?: number | null;
        commissionDate: Date;
        earnings: number;
        commissionRate: number;
        commission: number;
        totalPayout?: number;
        status: CommissionStatus;
    }): Promise<CommissionModel> {
        const totalPayout = data.totalPayout ?? data.commission;
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO commissions (chatter_id, company_id, shift_id, commission_date, earnings, commission_rate, commission, total_payout, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                data.chatterId,
                data.companyId,
                data.shiftId ?? null,
                data.commissionDate,
                data.earnings,
                data.commissionRate,
                data.commission,
                totalPayout,
                data.status,
            ]
        );
        const insertedId = Number(result.insertId);
        const created = await this.findById(insertedId, data.companyId);
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
        totalPayout?: number;
        status?: CommissionStatus;
    }, companyId?: number): Promise<CommissionModel | null> {
        const existing = await this.findById(id, companyId);
        if (!existing) return null;
        const shouldRecalculate = data.totalPayout === undefined && data.commission !== undefined;
        const totalPayout = data.totalPayout ?? (shouldRecalculate
            ? (data.commission ?? existing.commission)
            : existing.totalPayout);
        await this.execute<ResultSetHeader>(
            "UPDATE commissions SET chatter_id = ?, shift_id = ?, commission_date = ?, earnings = ?, commission_rate = ?, commission = ?, total_payout = ?, status = ? WHERE id = ?",
            [
                data.chatterId ?? existing.chatterId,
                data.shiftId !== undefined ? data.shiftId : existing.shiftId,
                data.commissionDate ?? existing.commissionDate,
                data.earnings ?? existing.earnings,
                data.commissionRate ?? existing.commissionRate,
                data.commission ?? existing.commission,
                totalPayout,
                data.status ?? existing.status,
                id,
            ]
        );
        return this.findById(id, companyId);
    }

    public async delete(id: number, companyId?: number): Promise<void> {
        const clause = companyId !== undefined ? " AND company_id = ?" : "";
        const values = companyId !== undefined ? [id, companyId] : [id];
        await this.execute<ResultSetHeader>(
            `DELETE FROM commissions WHERE id = ?${clause}`,
            values
        );
    }
}
