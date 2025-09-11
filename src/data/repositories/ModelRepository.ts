/**
 * ModelRepository module.
 */
import {BaseRepository} from "./BaseRepository";
import {IModelRepository} from "../interfaces/IModelRepository";
import {ModelModel} from "../../business/models/ModelModel";
import {ModelEarningsModel} from "../../business/models/ModelEarningsModel";
import {ResultSetHeader, RowDataPacket} from "mysql2";

/**
 * ModelRepository class.
 */
export class ModelRepository extends BaseRepository implements IModelRepository {
    public async findAll(): Promise<ModelModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, display_name, username, commission_rate, created_at FROM models",
            []
        );
        return rows.map(ModelModel.fromRow);
    }

    public async findById(id: number): Promise<ModelModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, display_name, username, commission_rate, created_at FROM models WHERE id = ?",
            [id]
        );
        return rows.length ? ModelModel.fromRow(rows[0]) : null;
    }

    public async create(data: { displayName: string; username: string; commissionRate: number; }): Promise<ModelModel> {
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO models (display_name, username, commission_rate) VALUES (?, ?, ?)",
            [data.displayName, data.username, data.commissionRate]
        );
        const insertedId = Number(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created model");
        return created;
    }

    public async update(id: number, data: { displayName?: string; username?: string; commissionRate?: number; }): Promise<ModelModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE models SET display_name = ?, username = ?, commission_rate = ? WHERE id = ?",
            [
                data.displayName ?? existing.displayName,
                data.username ?? existing.username,
                data.commissionRate ?? existing.commissionRate,
                id
            ]
        );
        return this.findById(id);
    }

    public async delete(id: number): Promise<void> {
        await this.execute<ResultSetHeader>(
            "DELETE FROM models WHERE id = ?",
            [id]
        );
    }

    public async findAllWithEarnings(): Promise<ModelEarningsModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT m.id,
                    m.display_name,
                    m.username,
                    m.commission_rate,
                    m.created_at,
                    COALESCE(SUM(ee.amount), 0) AS total_earnings
             FROM models m
                      LEFT JOIN employee_earnings ee ON ee.model_id = m.id
             GROUP BY m.id, m.display_name, m.username, m.commission_rate, m.created_at`,
            []
        );
        return rows.map(ModelEarningsModel.fromRow);
    }
}
