/**
 * BonusAwardRepository module.
 */
import { BaseRepository } from "./BaseRepository";
import {
    IBonusAwardRepository,
    BonusAwardCreateInput,
    BonusAwardQuery,
    BonusAwardTotals,
} from "../interfaces/IBonusAwardRepository";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { BonusAwardModel } from "../../business/models/BonusAwardModel";
import { PoolConnection } from "mysql2/promise";

/**
 * BonusAwardRepository class.
 */
export class BonusAwardRepository extends BaseRepository implements IBonusAwardRepository {
    public async create(data: BonusAwardCreateInput, connection?: PoolConnection): Promise<BonusAwardModel> {
        const params = [
            data.ruleId,
            data.companyId,
            data.workerId,
            data.stepsAwarded,
            data.bonusAmountCents,
            data.currency,
            data.awardedAt,
            data.reason ?? null,
            data.windowAnchor ?? null,
        ];

        if (connection) {
            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO bonus_awards (
                    rule_id,
                    company_id,
                    worker_id,
                    steps_awarded,
                    bonus_amount_cents,
                    currency,
                    awarded_at,
                    reason,
                    window_anchor
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                params,
            );
            const insertedId = Number(result.insertId);
            const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT id, rule_id, company_id, worker_id, steps_awarded, bonus_amount_cents, currency, awarded_at, reason, window_anchor, created_at
                 FROM bonus_awards
                 WHERE id = ?`,
                [insertedId],
            );
            if (!rows.length) {
                throw new Error("Failed to fetch inserted bonus award");
            }
            return BonusAwardModel.fromRow(rows[0]);
        }

        const result = await this.execute<ResultSetHeader>(
            `INSERT INTO bonus_awards (
                rule_id,
                company_id,
                worker_id,
                steps_awarded,
                bonus_amount_cents,
                currency,
                awarded_at,
                reason,
                window_anchor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params,
        );
        const created = await this.findById(Number(result.insertId));
        if (!created) {
            throw new Error("Failed to fetch inserted bonus award");
        }
        return created;
    }

    public async list(params: BonusAwardQuery): Promise<BonusAwardModel[]> {
        const conditions: string[] = ["company_id = ?"];
        const values: any[] = [params.companyId];

        if (params.workerId != null) {
            conditions.push("worker_id = ?");
            values.push(params.workerId);
        }
        if (params.from) {
            conditions.push("awarded_at >= ?");
            values.push(params.from);
        }
        if (params.to) {
            conditions.push("awarded_at <= ?");
            values.push(params.to);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const limitClause = params.limit ? " LIMIT ?" : "";
        const offsetClause = params.offset ? " OFFSET ?" : "";
        if (params.limit) {
            values.push(params.limit);
        }
        if (params.offset) {
            values.push(params.offset);
        }

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, rule_id, company_id, worker_id, steps_awarded, bonus_amount_cents, currency, awarded_at, reason, window_anchor, created_at
             FROM bonus_awards
             ${whereClause}
             ORDER BY awarded_at DESC, id DESC${limitClause}${offsetClause}`,
            values,
        );
        return rows.map(BonusAwardModel.fromRow);
    }

    public async totals(params: BonusAwardQuery): Promise<BonusAwardTotals> {
        const conditions: string[] = ["company_id = ?"];
        const values: any[] = [params.companyId];

        if (params.workerId != null) {
            conditions.push("worker_id = ?");
            values.push(params.workerId);
        }
        if (params.from) {
            conditions.push("awarded_at >= ?");
            values.push(params.from);
        }
        if (params.to) {
            conditions.push("awarded_at <= ?");
            values.push(params.to);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const rows = await this.execute<RowDataPacket[]>(
            `SELECT COUNT(*) AS count, COALESCE(SUM(bonus_amount_cents), 0) AS total_cents
             FROM bonus_awards
             ${whereClause}`,
            values,
        );
        const row = rows[0] ?? { count: 0, total_cents: 0 };
        return {
            count: Number(row.count ?? 0),
            totalCents: Number(row.total_cents ?? 0),
        };
    }

    private async findById(id: number): Promise<BonusAwardModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, rule_id, company_id, worker_id, steps_awarded, bonus_amount_cents, currency, awarded_at, reason, window_anchor, created_at
             FROM bonus_awards
             WHERE id = ?`,
            [id],
        );
        return rows.length ? BonusAwardModel.fromRow(rows[0]) : null;
    }
}
