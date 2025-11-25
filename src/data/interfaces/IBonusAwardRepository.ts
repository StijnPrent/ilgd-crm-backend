/**
 * IBonusAwardRepository module.
 */
import { BonusAwardModel } from "../../business/models/BonusAwardModel";
import { PoolConnection } from "mysql2/promise";

export interface BonusAwardQuery {
    companyId: number;
    workerId?: number;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}

export interface BonusAwardCreateInput {
    ruleId: number;
    companyId: number;
    workerId: number | null;
    stepsAwarded: number;
    bonusAmountCents: number;
    currency: string;
    awardedAt: Date;
    reason?: string | null;
    windowAnchor?: string | null;
}

export interface BonusAwardTotals {
    count: number;
    totalCents: number;
}

export interface IBonusAwardRepository {
    create(data: BonusAwardCreateInput, connection?: PoolConnection): Promise<BonusAwardModel>;
    list(params: BonusAwardQuery): Promise<BonusAwardModel[]>;
    totals(params: BonusAwardQuery): Promise<BonusAwardTotals>;
}
