import {BaseRepository} from "./BaseRepository";
import {IShiftRepository} from "../interfaces/IShiftRepository";
import {ShiftModel} from "../../business/models/ShiftModel";
import {ShiftStatus} from "../../rename/types";
import {ResultSetHeader, RowDataPacket} from "mysql2";

export class ShiftRepository extends BaseRepository implements IShiftRepository {
    public async findAll(): Promise<ShiftModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT s.id, s.chatter_id, s.date, s.start_time, s.end_time, s.status, s.created_at,
                    GROUP_CONCAT(sm.model_id) AS model_ids
               FROM shifts s
               LEFT JOIN shift_models sm ON sm.shift_id = s.id
               GROUP BY s.id
               ORDER BY s.start_time DESC`,
            []
        );
        return rows.map(ShiftModel.fromRow);
    }

    public async findById(id: number): Promise<ShiftModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT s.id, s.chatter_id, s.date, s.start_time, s.end_time, s.status, s.created_at,
                    GROUP_CONCAT(sm.model_id) AS model_ids
               FROM shifts s
               LEFT JOIN shift_models sm ON sm.shift_id = s.id
               WHERE s.id = ?
               GROUP BY s.id`,
            [id]
        );
        return rows.length ? ShiftModel.fromRow(rows[0]) : null;
    }

    public async create(data: { chatterId: number; modelIds: number[]; date: Date; start_time: Date; end_time?: Date | null; status: ShiftStatus; }): Promise<ShiftModel> {
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO shifts (chatter_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)",
            [data.chatterId, data.date, data.start_time, data.end_time ?? null, data.status]
        );
        const insertedId = Number(result.insertId);
        if (data.modelIds && data.modelIds.length) {
            for (const mid of data.modelIds) {
                await this.execute<ResultSetHeader>(
                    "INSERT INTO shift_models (shift_id, model_id) VALUES (?, ?)",
                    [insertedId, mid]
                );
            }
        }
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created shift");
        return created;
    }

    public async update(id: number, data: { chatterId?: number; modelIds?: number[]; date?: Date; start_time?: Date; end_time?: Date | null; status?: ShiftStatus; }): Promise<ShiftModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE shifts SET chatter_id = ?, date = ?, start_time = ?, end_time = ?, status = ? WHERE id = ?",
            [
                data.chatterId ?? existing.chatterId,
                data.date ?? existing.date,
                data.start_time ?? existing.startTime,
                data.end_time ?? existing.endTime,
                data.status ?? existing.status,
                id
            ]
        );
        if (data.modelIds) {
            await this.execute<ResultSetHeader>("DELETE FROM shift_models WHERE shift_id = ?", [id]);
            for (const mid of data.modelIds) {
                await this.execute<ResultSetHeader>("INSERT INTO shift_models (shift_id, model_id) VALUES (?, ?)", [id, mid]);
            }
        }
        return this.findById(id);
    }

    public async delete(id: number): Promise<void> {
        await this.execute<ResultSetHeader>("DELETE FROM shift_models WHERE shift_id = ?", [id]);
        await this.execute<ResultSetHeader>("DELETE FROM shifts WHERE id = ?", [id]);
    }

    public async findShiftForChatterAt(chatterId: number, datetime: Date): Promise<ShiftModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT s.id, s.chatter_id, s.date, s.start_time, s.end_time, s.status, s.created_at,
                    GROUP_CONCAT(sm.model_id) AS model_ids
               FROM shifts s
               LEFT JOIN shift_models sm ON sm.shift_id = s.id
               WHERE s.chatter_id = ? AND s.start_time <= ? AND (s.end_time IS NULL OR s.end_time >= ?)
               GROUP BY s.id
               ORDER BY s.start_time DESC LIMIT 1`,
            [chatterId, datetime, datetime]
        );
        return rows.length ? ShiftModel.fromRow(rows[0]) : null;
    }

    public async findShiftForModelAt(modelId: number, datetime: Date): Promise<ShiftModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT s.id, s.chatter_id, s.date, s.start_time, s.end_time, s.status, s.created_at,
                    GROUP_CONCAT(sm.model_id) AS model_ids
               FROM shifts s
               JOIN shift_models sm1 ON sm1.shift_id = s.id AND sm1.model_id = ?
               LEFT JOIN shift_models sm ON sm.shift_id = s.id
               WHERE s.start_time <= ? AND (s.end_time IS NULL OR s.end_time >= ?)
               GROUP BY s.id
               ORDER BY s.start_time DESC LIMIT 1`,
            [modelId, datetime, datetime]
        );
        return rows.length ? ShiftModel.fromRow(rows[0]) : null;
    }

    public getActiveTimeEntry(chatterId: number): Promise<ShiftModel | null> {
        return this.execute<RowDataPacket[]>(
            `SELECT s.id, s.chatter_id, s.date, s.start_time, s.end_time, s.status, s.created_at,
                    GROUP_CONCAT(sm.model_id) AS model_ids
               FROM shifts s
               LEFT JOIN shift_models sm ON sm.shift_id = s.id
               WHERE s.chatter_id = ? AND s.status IN ('active')
               GROUP BY s.id
               ORDER BY s.start_time DESC LIMIT 1;`,
            [chatterId]
        ).then(rows => rows.length ? ShiftModel.fromRow(rows[0]) : null);
    }
}
