import {BaseRepository} from "./BaseRepository";
import {IShiftRepository} from "../interfaces/IShiftRepository";
import {ShiftModel} from "../../business/models/ShiftModel";
import {ShiftStatus} from "../../rename/types";
import {ResultSetHeader, RowDataPacket} from "mysql2";

export class ShiftRepository extends BaseRepository implements IShiftRepository {
    public async findAll(): Promise<ShiftModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, date, start_time, end_time, status, created_at FROM shifts",
            []
        );
        return rows.map(ShiftModel.fromRow);
    }

    public async findById(id: number): Promise<ShiftModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, chatter_id, date, start_time, end_time, status, created_at FROM shifts WHERE id = ?",
            [id]
        );
        return rows.length ? ShiftModel.fromRow(rows[0]) : null;
    }

    public async create(data: { chatterId: number; date: Date; start_time: Date; end_time: Date; status: ShiftStatus; }): Promise<ShiftModel> {
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO shifts (chatter_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)",
            [data.chatterId, new Date(), data.start_time, data.end_time, data.status]
        );
        const insertedId = Number(result.insertId);
        const created = await this.findById(insertedId);
        if (!created) throw new Error("Failed to fetch created shift");
        return created;
    }

    public async update(id: number, data: { chatterId?: number; date?: Date; start_time?: Date; end_time?: Date; status?: ShiftStatus; }): Promise<ShiftModel | null> {
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
        return this.findById(id);
    }

    public async delete(id: number): Promise<void> {
        await this.execute<ResultSetHeader>(
            "DELETE FROM shifts WHERE id = ?",
            [id]
        );
    }
}
