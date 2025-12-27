import { ResultSetHeader, RowDataPacket } from "mysql2";
import { BaseRepository } from "./BaseRepository";
import { hashCookies, unhashCookies } from "../../utils/hashCookies";
import { generateCuid } from "../../utils/generateCuid";
import { F2FCookieEntry, F2FCookieSettingRecord } from "../models/F2FCookieSetting";
import { IF2FCookieSettingRepository } from "../interfaces/IF2FCookieSettingRepository";

interface F2FCookieSettingRow extends RowDataPacket {
    id: string;
    company_id: number;
    cookies: string;
    name: string | null;
    model_id: number | null;
    updated_at: Date | string | null;
    updated_by_id: string | number | null;
    updated_by_name: string | null;
}

interface CookieEarningTypeRow extends RowDataPacket {
    cookie_setting_id: string;
    earning_type_id: number;
    code: string;
}

type AllowedRelationship = "fan" | "follower";

function decodeCookiesPayload(raw: string): { cookies: string; allowedUserRelationships?: AllowedRelationship[] } {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return { cookies: "" };

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.cookies === "string") {
            const rels = Array.isArray(parsed.allowedUserRelationships)
                ? (parsed.allowedUserRelationships as any[])
                    .map(v => (typeof v === "string" ? v.toLowerCase().trim() : ""))
                    .filter((v): v is AllowedRelationship => v === "fan" || v === "follower")
                : undefined;
            return { cookies: parsed.cookies, allowedUserRelationships: rels && rels.length ? rels : undefined };
        }
    } catch (_) {
        // ignore - treat as legacy raw cookie string
    }

    return { cookies: trimmed };
}

function normalizeEntry(input: any): F2FCookieEntry | null {
    if (!input) return null;
    const decoded = typeof input.cookies === "string"
        ? decodeCookiesPayload(input.cookies)
        : decodeCookiesPayload(input.cookies?.cookies ?? "");
    const cookies = decoded.cookies.trim();
    if (!cookies) return null;
    const type = input.type === "model" ? "model" : "creator";
    const label = typeof input.label === "string" ? input.label.trim() || undefined : undefined;
    const modelUsername = typeof input.modelUsername === "string" ? input.modelUsername.trim() || undefined : undefined;
    const modelId = typeof input.modelId === "number" || typeof input.modelId === "string"
        ? input.modelId
        : undefined;
    const id = typeof input.id === "string" ? input.id : undefined;
    const updatedAt = input.updatedAt instanceof Date ? input.updatedAt : null;
    const updatedById = input.updatedById === null || input.updatedById === undefined ? null : String(input.updatedById);
    const updatedByName = typeof input.updatedByName === "string" ? input.updatedByName : undefined;
    const allowedUserRelationships = Array.isArray(input.allowedUserRelationships)
        ? (input.allowedUserRelationships as any[])
            .map(v => (typeof v === "string" ? v.toLowerCase().trim() : ""))
            .filter((v): v is AllowedRelationship => v === "fan" || v === "follower")
        : decoded.allowedUserRelationships;
    const allowedEarningTypeIds = Array.isArray(input.allowedEarningTypeIds)
        ? (input.allowedEarningTypeIds as any[])
            .map(v => Number(v))
            .filter(v => Number.isFinite(v))
        : undefined;
    const allowedEarningTypes = Array.isArray(input.allowedEarningTypes)
        ? (input.allowedEarningTypes as any[])
            .map(v => (typeof v === "string" ? v.toLowerCase().trim() : ""))
            .filter(Boolean)
        : undefined;
    return {
        id,
        type,
        cookies,
        label,
        modelUsername,
        modelId,
        allowedEarningTypeIds: allowedEarningTypeIds && allowedEarningTypeIds.length ? allowedEarningTypeIds : undefined,
        allowedEarningTypes: allowedEarningTypes && allowedEarningTypes.length ? allowedEarningTypes : undefined,
        allowedUserRelationships: allowedUserRelationships && allowedUserRelationships.length ? allowedUserRelationships : undefined,
        updatedAt,
        updatedById,
        updatedByName,
    };
}

function parseStoredEntries(raw: string): F2FCookieEntry[] {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed
                .map(normalizeEntry)
                .filter((e): e is F2FCookieEntry => !!e);
        }
    } catch (_) {
        // ignore - fall back to legacy parsing
    }

    return trimmed
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(cookies => ({ type: "creator", cookies }));
}

function serializeEntries(params: { cookies?: string; entries?: F2FCookieEntry[] }): { payload: string; entries: F2FCookieEntry[] } {
    if (params.entries && params.entries.length) {
        const normalized = params.entries
            .map(normalizeEntry)
            .filter((e): e is F2FCookieEntry => !!e);
        if (!normalized.length) {
            throw new Error("No valid F2F cookies provided");
        }
        return { payload: JSON.stringify(normalized), entries: normalized };
    }

    const trimmed = (params.cookies ?? "").trim();
    if (!trimmed) {
        throw new Error("'cookies' must not be empty");
    }
    return { payload: trimmed, entries: parseStoredEntries(trimmed) };
}

export class F2FCookieSettingRepository extends BaseRepository implements IF2FCookieSettingRepository {
    private async fetchAllowedEarningTypes(cookieIds: string[]): Promise<Map<string, { ids: number[]; codes: string[] }>> {
        const map = new Map<string, { ids: number[]; codes: string[] }>();
        if (!cookieIds.length) return map;

        const rows = await this.execute<CookieEarningTypeRow[]>(
            `SELECT f.cookie_setting_id, f.earning_type_id, et.code
             FROM f2f_cookie_setting_earning_types f
             INNER JOIN earning_types et ON et.id = f.earning_type_id
             WHERE f.cookie_setting_id IN (${cookieIds.map(() => "?").join(",")})`,
            cookieIds
        );

        for (const row of rows) {
            const existing = map.get(row.cookie_setting_id) ?? { ids: [], codes: [] };
            existing.ids.push(row.earning_type_id);
            if (row.code) existing.codes.push(String(row.code).toLowerCase());
            map.set(row.cookie_setting_id, existing);
        }
        return map;
    }

    private async resolveEarningTypeIds(codes: string[]): Promise<number[]> {
        if (!codes.length) return [];
        const normalized = Array.from(new Set(codes.map(c => c.toLowerCase().trim()).filter(Boolean)));
        if (!normalized.length) return [];
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, code FROM earning_types WHERE code IN (${normalized.map(() => "?").join(",")})`,
            normalized
        );
        const found = rows.map(r => Number(r.id)).filter(v => Number.isFinite(v));
        if (found.length !== normalized.length) {
            const foundCodes = new Set(rows.map(r => String(r.code).toLowerCase()));
            const missing = normalized.filter(c => !foundCodes.has(c));
            if (missing.length) {
                console.warn("[F2FCookieSettingRepository] Missing earning_types for codes:", missing);
            }
        }
        return found;
    }

    public async getF2FCookies({ companyId }: { companyId: number }): Promise<F2FCookieSettingRecord | null> {
        const rows = await this.execute<F2FCookieSettingRow[]>(
            "SELECT f.id, f.company_id, f.cookies, f.name, f.model_id, f.updated_at, f.updated_by_id, u.full_name AS updated_by_name FROM f2f_cookie_settings f LEFT JOIN users u ON u.id = f.updated_by_id WHERE f.company_id = ? ORDER BY f.updated_at DESC, f.id",
            [companyId]
        );

        if (!rows.length) {
            return null;
        }

        const allowedMap = await this.fetchAllowedEarningTypes(rows.map(r => String(r.id)));
        const entries: F2FCookieEntry[] = [];
        for (const row of rows) {
            let cookies = "";
            if (row.cookies) {
                try {
                    cookies = unhashCookies(String(row.cookies));
                } catch (error) {
                    console.error("[F2FCookieSettingRepository] Failed to decrypt cookies", error);
                    throw new Error("Stored F2F cookies are invalid. Please reconfigure the F2F cookies.");
                }
            }
            const e = normalizeEntry({
                id: row.id,
                type: row.model_id ? "model" : "creator",
                cookies,
                label: row.name ?? undefined,
                modelId: row.model_id ?? undefined,
                updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                updatedById: row.updated_by_id !== null && row.updated_by_id !== undefined ? String(row.updated_by_id) : null,
                updatedByName: row.updated_by_name ? String(row.updated_by_name) : null,
                allowedEarningTypeIds: allowedMap.get(String(row.id))?.ids,
                allowedEarningTypes: allowedMap.get(String(row.id))?.codes,
            });
            if (e) entries.push(e);
        }

        const first = rows[0];
        return {
            id: String(first.id),
            cookies: entries.length ? entries[0].cookies : "",
            entries,
            updatedAt: first.updated_at ? new Date(first.updated_at) : null,
            updatedById: first.updated_by_id !== null && first.updated_by_id !== undefined ? String(first.updated_by_id) : null,
            updatedByName: first.updated_by_name ? String(first.updated_by_name) : null,
        };
    }

    public async updateF2FCookies({
        companyId,
        cookies,
        entries,
        userId
    }: {
        companyId: number;
        cookies?: string;
        entries?: F2FCookieEntry[];
        userId: string | number | bigint;
    }): Promise<F2FCookieSettingRecord> {
        const normalizedUserId = userId === null || userId === undefined
            ? null
            : typeof userId === "bigint"
                ? userId.toString()
                : String(userId);

        const serialized = serializeEntries({ cookies, entries });

        // replace all rows for this company
        await this.execute<ResultSetHeader>(
            "DELETE FROM f2f_cookie_setting_earning_types WHERE cookie_setting_id IN (SELECT id FROM f2f_cookie_settings WHERE company_id = ?)",
            [companyId]
        );
        await this.execute<ResultSetHeader>(
            "DELETE FROM f2f_cookie_settings WHERE company_id = ?",
            [companyId]
        );

        for (const entry of serialized.entries) {
            const userRelationships = entry.allowedUserRelationships && entry.allowedUserRelationships.length
                ? Array.from(new Set(entry.allowedUserRelationships))
                : undefined;
            const cookiesPayload = userRelationships && userRelationships.length
                ? JSON.stringify({
                    cookies: entry.cookies,
                    allowedUserRelationships: userRelationships,
                })
                : entry.cookies;
            const hashed = hashCookies(cookiesPayload);
            const allowedTypeIds = entry.allowedEarningTypeIds && entry.allowedEarningTypeIds.length
                ? Array.from(new Set(entry.allowedEarningTypeIds.filter(v => Number.isFinite(v))))
                : entry.allowedEarningTypes && entry.allowedEarningTypes.length
                    ? await this.resolveEarningTypeIds(entry.allowedEarningTypes)
                    : [];
            const cookieId = typeof entry.id === "string" && entry.id ? entry.id : generateCuid();
            await this.execute<ResultSetHeader>(
                "INSERT INTO f2f_cookie_settings (id, company_id, cookies, name, model_id, updated_at, updated_by_id) VALUES (?, ?, ?, ?, ?, NOW(3), ?)",
                [
                    cookieId,
                    companyId,
                    hashed,
                    entry.label ?? null,
                    entry.modelId ?? null,
                    normalizedUserId,
                ]
            );

            if (allowedTypeIds.length) {
                const valuesClause = allowedTypeIds.map(() => "(?, ?, NOW(3))").join(", ");
                const params: any[] = [];
                for (const typeId of allowedTypeIds) {
                    params.push(cookieId, typeId);
                }
                await this.execute<ResultSetHeader>(
                    `INSERT INTO f2f_cookie_setting_earning_types (cookie_setting_id, earning_type_id, created_at) VALUES ${valuesClause}`,
                    params
                );
            }
        }

        const updated = await this.getF2FCookies({ companyId });
        if (!updated) {
            throw new Error("Failed to load F2F cookie setting after update");
        }
        return updated;
    }
}
