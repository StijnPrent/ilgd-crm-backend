/**
 * ShiftRequestRepository module.
 */
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {ShiftRequestModel} from "../../business/models/ShiftRequestModel";
import {
    CreateShiftRequestInput,
    IShiftRequestRepository,
    ShiftRequestFilters,
    UpdateShiftRequestInput,
} from "../interfaces/IShiftRequestRepository";
import {BaseRepository} from "./BaseRepository";

export class ShiftRequestRepository extends BaseRepository implements IShiftRequestRepository {
    private readonly baseSelect = `
        SELECT sr.id,
               sr.shift_id,
               sr.chatter_id,
               sr.type,
               sr.status,
               sr.note,
               sr.manager_note,
               sr.created_at,
               sr.updated_at,
               sr.resolved_at,
               s.date AS shift_date,
               s.start_time AS shift_start_time,
               s.end_time AS shift_end_time,
               COALESCE(u.full_name, u.username, c.email) AS chatter_name
          FROM shift_requests sr
          JOIN shifts s ON s.id = sr.shift_id
          LEFT JOIN chatters c ON c.id = sr.chatter_id
          LEFT JOIN users u ON u.id = sr.chatter_id
    `;

    public async findAll(filters?: ShiftRequestFilters): Promise<ShiftRequestModel[]> {
        const where: string[] = [];
        const params: any[] = [];

        if (filters?.status) {
            where.push("sr.status = ?");
            params.push(filters.status);
        }

        if (filters?.chatterId !== undefined) {
            where.push("sr.chatter_id = ?");
            params.push(filters.chatterId);
        }

        if (!filters?.includeResolved) {
            where.push("sr.status <> 'resolved'");
        }

        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const rows = await this.execute<RowDataPacket[]>(
            `${this.baseSelect}
             ${whereClause}
             ORDER BY sr.created_at DESC`,
            params,
        );
        return rows.map(ShiftRequestModel.fromRow);
    }

    public async findById(id: number): Promise<ShiftRequestModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            `${this.baseSelect}
             WHERE sr.id = ?
             LIMIT 1`,
            [id],
        );
        return rows.length ? ShiftRequestModel.fromRow(rows[0]) : null;
    }

    public async create(data: CreateShiftRequestInput): Promise<ShiftRequestModel> {
        const result = await this.execute<ResultSetHeader>(
            `INSERT INTO shift_requests (shift_id, chatter_id, type, status, note)
             VALUES (?, ?, ?, ?, ?)`
            ,
            [
                data.shiftId,
                data.chatterId,
                data.type,
                "pending",
                data.note ?? null,
            ],
        );
        const createdId = Number(result.insertId);
        const model = await this.findById(createdId);
        if (!model) {
            throw new Error("Failed to fetch created shift request");
        }
        return model;
    }

    public async update(id: number, data: UpdateShiftRequestInput): Promise<ShiftRequestModel | null> {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        const nextStatus = data.status ?? existing.status;
        const nextManagerNote = data.managerNote !== undefined ? data.managerNote : existing.managerNote;
        const nextResolvedAt = data.resolvedAt !== undefined ? data.resolvedAt : existing.resolvedAt;

        await this.execute<ResultSetHeader>(
            `UPDATE shift_requests
                SET status = ?,
                    manager_note = ?,
                    resolved_at = ?,
                    updated_at = NOW()
              WHERE id = ?`,
            [
                nextStatus,
                nextManagerNote ?? null,
                nextResolvedAt ?? null,
                id,
            ],
        );

        return this.findById(id);
    }
}
