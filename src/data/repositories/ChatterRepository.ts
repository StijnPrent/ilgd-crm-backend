import {BaseRepository} from "./BaseRepository";
import {IChatterRepository} from "../interfaces/IChatterRepository";
import {ChatterModel} from "../../business/models/ChatterModel";
import {ChatterStatus, CurrencySymbol} from "../../rename/types";
import {ResultSetHeader, RowDataPacket} from "mysql2";

export class ChatterRepository extends BaseRepository implements IChatterRepository {
    public async findAll(): Promise<ChatterModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, email, currency, commission_rate, platform_fee, status, created_at FROM chatters",
            []
        );
        return rows.map(ChatterModel.fromRow);
    }

    public async findById(id: number): Promise<ChatterModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, email, currency, commission_rate, platform_fee, status, created_at FROM chatters WHERE id = ?",
            [id]
        );
        return rows.length ? ChatterModel.fromRow(rows[0]) : null;
    }

    public async findByEmail(email: string): Promise<ChatterModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, email, currency, commission_rate, platform_fee, status, created_at FROM chatters WHERE email = ?",
            [email]
        );
        return rows.length ? ChatterModel.fromRow(rows[0]) : null;
    }

    public async findOnline(): Promise<ChatterModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT DISTINCT c.id, c.email, c.currency, c.commission_rate, c.platform_fee, c.status, c.created_at
               FROM chatters c
               JOIN shifts s ON s.chatter_id = c.id
               WHERE s.status = 'active'`,
            []
        );
        return rows.map(ChatterModel.fromRow);
    }

    public async create(data: {userId: number, email: string; currency: CurrencySymbol; commissionRate: number; platformFeeRate: number; status: ChatterStatus; }): Promise<ChatterModel> {
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO chatters (id, email, currency, commission_rate, platform_fee, status) VALUES (?, ?, ?, ?, ?, ?)",
            [data.userId, data.email, data.currency, data.commissionRate, data.platformFeeRate, 'active']
        );
        const created = await this.findById(data.userId);
        if (!created) throw new Error("Failed to fetch created chatter");
        return created;
    }

    public async update(id: number, data: { email?: string; currency?: CurrencySymbol; commissionRate?: number; platformFee?: number; status?: ChatterStatus; }): Promise<ChatterModel | null> {
        const existing = await this.findById(id);
        if (!existing) return null;
        await this.execute<ResultSetHeader>(
            "UPDATE chatters SET email = ?, currency = ?, commission_rate = ?, platform_fee = ?, status = ? WHERE id = ?",
            [
                data.email ?? existing.email,
                data.currency ?? existing.currency,
                data.commissionRate ?? existing.commissionRate,
                data.platformFee ?? existing.platformFee,
                data.status ?? existing.status,
                id
            ]
        );
        return this.findById(id);
    }

    public async delete(id: number): Promise<void> {
        await this.execute<ResultSetHeader>(
            "DELETE FROM chatters WHERE id = ?",
            [id]
        );
    }
}
