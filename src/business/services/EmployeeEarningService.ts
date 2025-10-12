/**
 * EmployeeEarningService module.
 */
import {inject, injectable} from "tsyringe";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../models/EmployeeEarningModel";
import {ChatterLeaderboardModel} from "../models/ChatterLeaderboardModel";
import {F2FTransactionSyncService} from "./F2FTransactionSyncService";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {CommissionService} from "./CommissionService";

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
    ) {}

    /**
     * Retrieves all employee earnings after syncing recent transactions.
     */
    public async getAll(params: {
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
        if ((params.offset ?? 0) <= 0) {
            await this.txnSync.syncRecentTransactions().catch(console.error);
        }
        return this.earningRepo.findAll(params);
    }

    public async totalCount(params: {
        chatterId?: number;
        types?: string[];
        modelId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
        shiftId?: number;
    } = {}): Promise<number> {
        return this.earningRepo.totalCount(params);
    }

    /**
     * Retrieves an earning by its ID after syncing transactions.
     * @param id Earning identifier.
     */
    public async getById(id: string): Promise<EmployeeEarningModel | null> {
        await this.txnSync.syncRecentTransactions().catch(console.error);
        return this.earningRepo.findById(id);
    }

    /**
     * Retrieves earnings for a specific chatter.
     */
    public async getByChatter(chatterId: number): Promise<EmployeeEarningModel[]> {
        await this.txnSync.syncRecentTransactions().catch(console.error);
        return this.earningRepo.findByChatter(chatterId);
    }

    /**
     * Retrieves leaderboard data aggregated per chatter.
     */
    public async getLeaderboard(params: {from?: Date; to?: Date} = {}): Promise<ChatterLeaderboardModel[]> {
        await this.txnSync.syncRecentTransactions().catch(console.error);

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

        const rows = await this.earningRepo.getLeaderboard({
            startOfWeek,
            startOfMonth,
            from: fromDate,
            to: toDate,
        });
        rows.sort((a, b) => b.weekAmount - a.weekAmount);
        return rows.map((r, idx) => new ChatterLeaderboardModel(r.chatterId, r.chatterName, r.weekAmount, r.monthAmount, idx + 1));
    }

    /**
     * Syncs earnings with chatters for a given period.
     */
    public async syncWithChatters(from: Date, to: Date): Promise<{created: number; updated: number}> {
        const created = await this.txnSync.syncTransactionsBetween(from, to);

        const earnings = await this.earningRepo.findWithoutChatterBetween(from, to);
        let updated = 0;
        for (const e of earnings) {
            if (!e.modelId) continue;
            const shift = await this.shiftRepo.findShiftForModelAt(e.modelId, e.date);
            if (shift?.chatterId) {
                await this.earningRepo.update(e.id, {chatterId: shift.chatterId, shiftId: shift.id});
                updated++;
            }
        }
        return {created, updated};
    }

    /**
     * Creates a new employee earning record.
     * @param data Earning details.
     */
    public async create(data: { chatterId: number | null; modelId: number | null; shiftId?: number | null; date: Date; amount: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel> {
        return this.earningRepo.create(data);
    }

    /**
     * Updates an existing earning record.
     * @param id Earning identifier.
     * @param data Partial earning data.
     */
    public async update(id: string, data: { chatterId?: number | null; modelId?: number | null; shiftId?: number | null; date?: Date; amount?: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel | null> {
        const before = await this.earningRepo.findById(id);
        if (!before) {
            return null;
        }

        const updated = await this.earningRepo.update(id, data);

        if (!updated) {
            return null;
        }

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
        const commissionAdjustments: Array<{ chatterId: number; date: Date; delta: number }> = [];

        if (before.chatterId) {
            commissionAdjustments.push({ chatterId: before.chatterId, date: before.date, delta: -before.amount });
        }

        if (after.chatterId) {
            commissionAdjustments.push({ chatterId: after.chatterId, date: after.date, delta: after.amount });
        }

        for (const adjustment of commissionAdjustments) {
            if (!adjustment.delta) {
                continue;
            }

            await this.commissionService.applyEarningDeltaToClosestCommission(adjustment.chatterId, adjustment.date, adjustment.delta);
        }
    }
}
