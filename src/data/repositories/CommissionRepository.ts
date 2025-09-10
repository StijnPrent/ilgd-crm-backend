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
    public async findAll(): Promise<CommissionModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, period_start, period_end, earnings, commission_rate, commission, status, created_at FROM commissions",
            []
        );
        return rows.map(CommissionModel.fromRow);
    }

    public async findById(id: number): Promise<CommissionModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, period_start, period_end, earnings, commission_rate, commission, status, created_at FROM commissions WHERE id = ?",
            [id]
        );
        return rows.length ? CommissionModel.fromRow(rows[0]) : null;
    }

    public async create(data: {
        chatterId: number;
        periodStart: Date;
        periodEnd: Date;
        earnings: number;
        commissionRate: number;
        commission: number;
        status: CommissionStatus;
    }): Promise<CommissionModel> {
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO commissions (chatter_id, period_start, period_end, earnings, commission_rate, commission, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [data.chatterId, data.periodStart, data.periodEnd, data.earnings, data.commissionRate, data.commission, data.status]
        );
        const insertedId = Number(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created commission");
        return created;
    }

    public async update(id: number, data: {
        chatterId?: number;
        periodStart?: Date;
        periodEnd?: Date;
        earnings?: number;
        commissionRate?: number;
        commission?: number;
        status?: CommissionStatus;
    }): Promise<CommissionModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE commissions SET chatter_id = ?, period_start = ?, period_end = ?, earnings = ?, commission_rate = ?, commission = ?, status = ? WHERE id = ?",
            [
                data.chatterId ?? existing.chatterId,
                data.periodStart ?? existing.periodStart,
                data.periodEnd ?? existing.periodEnd,
                data.earnings ?? existing.earnings,
                data.commissionRate ?? existing.commissionRate,
                data.commission ?? existing.commission,
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
