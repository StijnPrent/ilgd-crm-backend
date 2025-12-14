/**
 * EmployeeEarningService module.
 */
import {inject, injectable} from "tsyringe";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../models/EmployeeEarningModel";
import {ChatterLeaderboardModel} from "../models/ChatterLeaderboardModel";
import {F2FTransactionSyncService} from "./F2FTransactionSyncService";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {CommissionService, COMMISSION_ELIGIBLE_EARNING_TYPES} from "./CommissionService";
import {BonusEvaluationService} from "./BonusEvaluationService";
import {resolveCompanyId} from "../../config/bonus";

/**
 * Service for managing employee earnings and syncing transactions.
 */
@injectable()
/**
 * EmployeeEarningService class.
 */
export class EmployeeEarningService {
    constructor(
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        private txnSync: F2FTransactionSyncService,
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
        @inject("CommissionService") private commissionService: CommissionService,
        @inject("BonusEvaluationService") private bonusEvaluationService: BonusEvaluationService,
    ) {}

    /**
     * Retrieves all employee earnings after syncing recent transactions.
     */
    public async getAll(params: {
        companyId?: number;
        limit?: number;
        offset?: number;
        chatterId?: number;
        types?: string[];
        date?: Date;
        from?: Date;
        to?: Date;
        shiftId?: number;
        modelId?: number;
    } = {}): Promise<EmployeeEarningModel[]> {
        const {companyId: companyIdInput, ...rest} = params;
        const companyId = resolveCompanyId(companyIdInput ?? null);

        if ((rest.offset ?? 0) <= 0) {
            await this.syncRecentTransactions("getAll");
        }
        return this.earningRepo.findAll({...rest, companyId});
    }

    public async totalCount(params: {
        companyId?: number;
        chatterId?: number;
        types?: string[];
        modelId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
        shiftId?: number;
    } = {}): Promise<number> {
        const {companyId: companyIdInput, ...rest} = params;
        const companyId = resolveCompanyId(companyIdInput ?? null);
        return this.earningRepo.totalCount({...rest, companyId});
    }

    /**
     * Retrieves an earning by its ID after syncing transactions.
     * @param id Earning identifier.
     */
    public async getById(id: string, companyId?: number): Promise<EmployeeEarningModel | null> {
        await this.syncRecentTransactions("getById");
        const resolvedCompanyId = resolveCompanyId(companyId ?? null);
        return this.earningRepo.findById(id, {companyId: resolvedCompanyId});
    }

    /**
     * Retrieves earnings for a specific chatter.
     */
    public async getByChatter(chatterId: number, companyId?: number): Promise<EmployeeEarningModel[]> {
        await this.syncRecentTransactions("getByChatter");
        const resolvedCompanyId = resolveCompanyId(companyId ?? null);
        return this.earningRepo.findByChatter(chatterId, {companyId: resolvedCompanyId});
    }

    /**
     * Retrieves leaderboard data aggregated per chatter.
     */
    public async getLeaderboard(params: {companyId?: number; from?: Date; to?: Date} = {}): Promise<ChatterLeaderboardModel[]> {
        await this.syncRecentTransactions("getLeaderboard");

        const now = new Date();
        const toDate = params.to ? new Date(params.to) : undefined;
        const fromDate = params.from ? new Date(params.from) : undefined;

        let referenceDate = toDate ? new Date(toDate) : new Date(now);
        if (referenceDate.getTime() > now.getTime()) {
            referenceDate = now;
        }

        const startOfWeek = new Date(Date.UTC(
            referenceDate.getUTCFullYear(),
            referenceDate.getUTCMonth(),
            referenceDate.getUTCDate(),
        ));
        const day = referenceDate.getUTCDay();
        const diff = (day + 6) % 7; // Monday = 0
        startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff);

        if (fromDate && startOfWeek.getTime() < fromDate.getTime()) {
            startOfWeek.setTime(fromDate.getTime());
        }

        let startOfMonth: Date;
        if (fromDate) {
            startOfMonth = new Date(fromDate.getTime());
            startOfMonth.setUTCHours(0, 0, 0, 0);
        } else {
            startOfMonth = new Date(Date.UTC(
                referenceDate.getUTCFullYear(),
                referenceDate.getUTCMonth(),
                1,
            ));
        }

        const companyId = resolveCompanyId(params.companyId ?? null);

        const rows = await this.earningRepo.getLeaderboard({
            companyId,
            startOfWeek,
            startOfMonth,
            from: fromDate,
            to: toDate,
        });
        rows.sort((a, b) => b.weekAmount - a.weekAmount);
        return rows.map((r, idx) => new ChatterLeaderboardModel(r.chatterId, r.chatterName, r.weekAmount, r.monthAmount, idx + 1));
    }

    private async syncRecentTransactions(context: string): Promise<void> {
        try {
            await this.txnSync.syncRecentTransactions();
        } catch (err) {
            console.error(`EmployeeEarningService.${context}: failed to sync recent transactions`, err);
        }
    }

    /**
     * Syncs earnings with chatters for a given period.
     */
    public async syncWithChatters(from: Date, to: Date, companyId?: number): Promise<{created: number; updated: number}> {
        const resolvedCompanyId = resolveCompanyId(companyId ?? null);
        const created = await this.txnSync.syncTransactionsBetween(from, to);

        const earnings = await this.earningRepo.findWithoutChatterBetween(from, to, {companyId: resolvedCompanyId});
        let updated = 0;
        for (const e of earnings) {
            if (!e.modelId) continue;
            const shift = await this.shiftRepo.findShiftForModelAt(e.modelId, e.date);
            if (shift?.chatterId) {
                await this.earningRepo.update(e.id, {companyId: resolvedCompanyId, chatterId: shift.chatterId, shiftId: shift.id});
                updated++;
            }
        }
        return {created, updated};
    }

    /**
     * Creates a new employee earning record.
     * @param data Earning details.
     */
    public async create(data: { companyId?: number; chatterId: number | null; modelId: number | null; shiftId?: number | null; date: Date; amount: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel> {
        const companyId = resolveCompanyId(data.companyId ?? null);
        const created = await this.earningRepo.create({...data, companyId});
        this.triggerBonusEvaluation(created).catch(err => {
            console.error("[bonus] Failed to evaluate bonuses after earning creation", err);
        });
        return created;
    }

    /**
     * Updates an existing earning record.
     * @param id Earning identifier.
     * @param data Partial earning data.
     */
    public async update(id: string, data: { companyId?: number; chatterId?: number | null; modelId?: number | null; shiftId?: number | null; date?: Date; amount?: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel | null> {
        const companyId = resolveCompanyId(data.companyId ?? null);
        const before = await this.earningRepo.findById(id, {companyId});
        if (!before) {
            console.log(`EmployeeEarningService.update: earning ${id} not found`);
            return null;
        }

        console.log(`EmployeeEarningService.update: current earning ${id} -> ${JSON.stringify(before)}`);
        console.log(`EmployeeEarningService.update: applying changes ${JSON.stringify(data)}`);
        const updated = await this.earningRepo.update(id, {...data, companyId});

        if (!updated) {
            console.log(`EmployeeEarningService.update: repository returned null for earning ${id}`);
            return null;
        }

        console.log(`EmployeeEarningService.update: updated earning ${id} -> ${JSON.stringify(updated)}`);
        await this.refreshCommissionsForEarningChange(before, updated);

        return updated;
    }

    /**
     * Deletes an earning record.
     * @param id Earning identifier.
     */
    public async delete(id: string): Promise<void> {
        await this.earningRepo.delete(id);
    }

    private async refreshCommissionsForEarningChange(before: EmployeeEarningModel, after: EmployeeEarningModel): Promise<void> {
        const commissionAdjustments: Array<{ companyId: number; chatterId: number; date: Date; delta: number; shiftId?: number | null }> = [];

        if (before.chatterId && this.isCommissionEligibleType(before.type)) {
            commissionAdjustments.push({ companyId: before.companyId, chatterId: before.chatterId, date: before.date, delta: -before.amount, shiftId: before.shiftId });
        }

        if (after.chatterId && this.isCommissionEligibleType(after.type)) {
            commissionAdjustments.push({ companyId: after.companyId, chatterId: after.chatterId, date: after.date, delta: after.amount, shiftId: after.shiftId });
        }

        for (const adjustment of commissionAdjustments) {
            if (!adjustment.delta) {
                continue;
            }

            await this.commissionService.applyEarningDeltaToClosestCommission(
                adjustment.companyId,
                adjustment.chatterId,
                adjustment.date,
                adjustment.delta,
                adjustment.shiftId,
            );
        }
    }

    private async triggerBonusEvaluation(earning: EmployeeEarningModel): Promise<void> {
        const companyId = resolveCompanyId(earning.companyId ?? null);
        const asOf = earning.date instanceof Date ? earning.date : new Date();

        if (earning.chatterId != null) {
            await this.bonusEvaluationService.evaluateActiveRulesForTarget(
                companyId,
                "worker",
                earning.chatterId,
                { asOf },
            );
        }

        // simplified bonuses: no company-scope rules
    }

    private isCommissionEligibleType(type?: string | null): boolean {
        if (!type) {
            return false;
        }
        // Compare case-insensitively to align with DB collation and
        // CommissionService eligibility filtering.
        return COMMISSION_ELIGIBLE_EARNING_TYPES.includes(String(type).toLowerCase());
    }
}
