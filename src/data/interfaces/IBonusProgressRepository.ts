/**
 * IBonusProgressRepository module.
 */
import { BonusProgressModel } from "../../business/models/BonusProgressModel";
import { PoolConnection } from "mysql2/promise";

export interface BonusProgressQuery {
    companyId: number;
    workerId?: number;
}

export interface BonusProgressUpsertInput {
    ruleId: number;
    companyId: number;
    workerId: number | null;
    lastObservedSteps: number;
    lastComputedAt: Date;
}

export interface IBonusProgressRepository {
    get(
        ruleId: number,
        companyId: number,
        workerId: number | null,
        opts?: { connection?: PoolConnection; forUpdate?: boolean },
    ): Promise<BonusProgressModel | null>;

    upsert(
        data: BonusProgressUpsertInput,
        connection?: PoolConnection,
    ): Promise<BonusProgressModel>;

    list(params: BonusProgressQuery): Promise<BonusProgressModel[]>;
}
