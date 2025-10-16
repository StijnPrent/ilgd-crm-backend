import { ResultSetHeader, RowDataPacket } from "mysql2";
import { BaseRepository } from "./BaseRepository";
import { hashCookies } from "../../utils/hashCookies";
import { generateCuid } from "../../utils/generateCuid";
import { F2FCookieSettingRecord } from "../models/F2FCookieSetting";
import { IF2FCookieSettingRepository } from "../interfaces/IF2FCookieSettingRepository";

interface F2FCookieSettingRow extends RowDataPacket {
    id: string;
    cookies: string;
    updated_at: Date | string | null;
    updated_by_id: string | number | null;
    updated_by_name: string | null;
}

export class F2FCookieSettingRepository extends BaseRepository implements IF2FCookieSettingRepository {
    public async getF2FCookies(): Promise<F2FCookieSettingRecord | null> {
        const rows = await this.execute<F2FCookieSettingRow[]>(
            "SELECT f.id, f.cookies, f.updated_at, f.updated_by_id, u.full_name AS updated_by_name FROM f2f_cookie_settings f LEFT JOIN users u ON u.id = f.updated_by_id LIMIT 1",
            []
        );

        if (!rows.length) {
            return null;
        }

        const row = rows[0];
        return {
            id: String(row.id),
            cookies: String(row.cookies ?? ""),
            updatedAt: row.updated_at ? new Date(row.updated_at) : null,
            updatedById: row.updated_by_id !== null && row.updated_by_id !== undefined ? String(row.updated_by_id) : null,
            updatedByName: row.updated_by_name ? String(row.updated_by_name) : null,
        };
    }

    public async updateF2FCookies({ cookies, userId }: { cookies: string; userId: string | number | bigint; }): Promise<F2FCookieSettingRecord> {
        const hashedCookies = hashCookies(cookies);
        const normalizedUserId = userId === null || userId === undefined
            ? null
            : typeof userId === "bigint"
                ? userId.toString()
                : String(userId);

        const existing = await this.execute<RowDataPacket[]>(
            "SELECT id FROM f2f_cookie_settings LIMIT 1",
            []
        );

        if (existing.length) {
            await this.execute<ResultSetHeader>(
                "UPDATE f2f_cookie_settings SET cookies = ?, updated_at = NOW(3), updated_by_id = ? WHERE id = ?",
                [hashedCookies, normalizedUserId, existing[0].id]
            );
        } else {
            const id = generateCuid();
            await this.execute<ResultSetHeader>(
                "INSERT INTO f2f_cookie_settings (id, cookies, updated_at, updated_by_id) VALUES (?, ?, NOW(3), ?)",
                [id, hashedCookies, normalizedUserId]
            );
        }

        const updated = await this.getF2FCookies();
        if (!updated) {
            throw new Error("Failed to load Face2Face cookie setting after update");
        }
        return updated;
    }
}
