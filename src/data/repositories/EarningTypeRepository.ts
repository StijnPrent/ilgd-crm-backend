import { RowDataPacket } from "mysql2";
import { BaseRepository } from "./BaseRepository";
import { IEarningTypeRepository } from "../interfaces/IEarningTypeRepository";

interface EarningTypeRow extends RowDataPacket {
    id: number;
    code: string;
    label: string | null;
}

export class EarningTypeRepository extends BaseRepository implements IEarningTypeRepository {
    public async listActive(): Promise<{ id: number; code: string; label: string | null }[]> {
        const rows = await this.execute<EarningTypeRow[]>(
            "SELECT id, code, label FROM earning_types WHERE active = 1 ORDER BY code"
        );
        return rows.map(r => ({
            id: Number(r.id),
            code: String(r.code),
            label: r.label === null ? null : String(r.label),
        }));
    }
}
