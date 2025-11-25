/**
 * BonusRuleRepository module.
 */
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { BaseRepository } from "./BaseRepository";
import { IBonusRuleRepository, BonusRuleCreateInput, BonusRuleUpdateInput, BonusRuleQuery } from "../interfaces/IBonusRuleRepository";
import { BonusRuleModel, RuleConfigInput } from "../../business/models/BonusRuleModel";

function serializeConfig(config: RuleConfigInput): string {
    return JSON.stringify(config ?? {});
}

/**
 * BonusRuleRepository class.
 */
export class BonusRuleRepository extends BaseRepository implements IBonusRuleRepository {
    public async findAll(params: BonusRuleQuery = {}): Promise<BonusRuleModel[]> {
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.companyId != null) {
            conditions.push("company_id = ?");
            values.push(params.companyId);
        }
        if (params.isActive != null) {
            conditions.push("is_active = ?");
            values.push(params.isActive ? 1 : 0);
        }
        if (params.scope) {
            conditions.push("scope = ?");
            values.push(params.scope);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, company_id, name, is_active, priority, scope, window_type, window_seconds, rule_type, rule_config, created_at, updated_at
             FROM bonus_rules
             ${whereClause}
             ORDER BY priority DESC, created_at DESC`,
            values,
        );

        return rows.map(BonusRuleModel.fromRow);
    }

    public async findById(id: number): Promise<BonusRuleModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, company_id, name, is_active, priority, scope, window_type, window_seconds, rule_type, rule_config, created_at, updated_at
             FROM bonus_rules
             WHERE id = ?`,
            [id],
        );
        return rows.length ? BonusRuleModel.fromRow(rows[0]) : null;
    }

    public async findActiveByCompany(companyId: number): Promise<BonusRuleModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            `SELECT id, company_id, name, is_active, priority, scope, window_type, window_seconds, rule_type, rule_config, created_at, updated_at
             FROM bonus_rules
             WHERE company_id = ? AND is_active = 1
             ORDER BY priority DESC, created_at DESC`,
            [companyId],
        );
        return rows.map(BonusRuleModel.fromRow);
    }

    public async create(data: BonusRuleCreateInput): Promise<BonusRuleModel> {
        const result = await this.execute<ResultSetHeader>(
            `INSERT INTO bonus_rules (
                company_id,
                name,
                is_active,
                priority,
                scope,
                window_type,
                window_seconds,
                rule_type,
                rule_config
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.companyId,
                data.name,
                data.isActive ? 1 : 0,
                data.priority,
                data.scope,
                data.windowType,
                data.windowSeconds,
                data.ruleType,
                serializeConfig(data.ruleConfig),
            ],
        );
        const created = await this.findById(Number(result.insertId));
        if (!created) {
            throw new Error("Failed to fetch created bonus rule");
        }
        return created;
    }

    public async update(id: number, data: BonusRuleUpdateInput): Promise<BonusRuleModel | null> {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        await this.execute<ResultSetHeader>(
            `UPDATE bonus_rules
             SET name = ?,
                 is_active = ?,
                 priority = ?,
                 scope = ?,
                 window_type = ?,
                 window_seconds = ?,
                 rule_type = ?,
                 rule_config = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [
                data.name ?? existing.name,
                data.isActive != null ? (data.isActive ? 1 : 0) : (existing.isActive ? 1 : 0),
                data.priority ?? existing.priority,
                data.scope ?? existing.scope,
                data.windowType ?? existing.windowType,
                data.windowSeconds ?? existing.windowSeconds,
                data.ruleType ?? existing.ruleType,
                serializeConfig(data.ruleConfig ?? existing.ruleConfig),
                id,
            ],
        );

        return this.findById(id);
    }
}
