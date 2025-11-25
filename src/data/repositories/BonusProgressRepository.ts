/**
 * BonusProgressRepository module.
 */
import { BaseRepository } from "./BaseRepository";
import {
    IBonusProgressRepository,
    BonusProgressQuery,
    BonusProgressUpsertInput,
} from "../interfaces/IBonusProgressRepository";
import { BonusProgressModel } from "../../business/models/BonusProgressModel";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";

function buildWorkerCondition(workerId: number | null): { clause: string; params: any[] } {
    if (workerId == null) {
        return { clause: "bp.worker_id IS NULL", params: [] };
    }
    return { clause: "bp.worker_id = ?", params: [workerId] };
}

/**
 * BonusProgressRepository class.
 */
export class BonusProgressRepository extends BaseRepository implements IBonusProgressRepository {
    public async get(
        ruleId: number,
        companyId: number,
        workerId: number | null,
        opts: { connection?: PoolConnection; forUpdate?: boolean } = {},
    ): Promise<BonusProgressModel | null> {
        const { clause, params } = buildWorkerCondition(workerId);
        // MariaDB expects LIMIT to appear before FOR UPDATE
        const sql = `SELECT bp.id,
                            bp.rule_id,
                            bp.company_id,
                            bp.worker_id,
                            u.full_name AS worker_name,
                            bp.last_observed_steps,
                            bp.last_computed_at,
                            bp.created_at,
                            bp.updated_at
                     FROM bonus_progress bp
                     LEFT JOIN users u ON u.id = bp.worker_id
                     WHERE bp.rule_id = ? AND bp.company_id = ? AND ${clause}
                     LIMIT 1 ${opts.forUpdate ? "FOR UPDATE" : ""}`;
        const values = [ruleId, companyId, ...params];

        if (opts.connection) {
            const [rows] = await opts.connection.query<RowDataPacket[]>(sql, values);
            return rows.length ? BonusProgressModel.fromRow(rows[0]) : null;
        }

        const rows = await this.execute<RowDataPacket[]>(sql, values);
        return rows.length ? BonusProgressModel.fromRow(rows[0]) : null;
    }

    public async upsert(
        data: BonusProgressUpsertInput,
        connection?: PoolConnection,
    ): Promise<BonusProgressModel> {
        const params = [
            data.ruleId,
            data.companyId,
            data.workerId,
            data.lastObservedSteps,
            data.lastComputedAt,
        ];
        const sql = `INSERT INTO bonus_progress (
                rule_id,
                company_id,
                worker_id,
                last_observed_steps,
                last_computed_at
            ) VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                last_observed_steps = VALUES(last_observed_steps),
                last_computed_at = VALUES(last_computed_at),
                updated_at = NOW()`;

        if (connection) {
            await connection.query<ResultSetHeader>(sql, params);
            const record = await this.get(
                data.ruleId,
                data.companyId,
                data.workerId,
                { connection },
            );
            if (!record) {
                throw new Error("Failed to fetch upserted bonus progress");
            }
            return record;
        }

        await this.execute<ResultSetHeader>(sql, params);
        const record = await this.get(data.ruleId, data.companyId, data.workerId);
        if (!record) {
            throw new Error("Failed to fetch upserted bonus progress");
        }
        return record;
    }

    public async list(params: BonusProgressQuery): Promise<BonusProgressModel[]> {
        const conditions: string[] = ["bp.company_id = ?"];
        const values: any[] = [params.companyId];

        if (params.workerId != null) {
            conditions.push("bp.worker_id = ?");
            values.push(params.workerId);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT bp.id,
                    bp.rule_id,
                    bp.company_id,
                    bp.worker_id,
                    u.full_name AS worker_name,
                    bp.last_observed_steps,
                    bp.last_computed_at,
                    bp.created_at,
                    bp.updated_at
             FROM bonus_progress bp
             LEFT JOIN users u ON u.id = bp.worker_id
             ${whereClause}
             ORDER BY bp.updated_at DESC`,
            values,
        );
        return rows.map(BonusProgressModel.fromRow);
    }
}
