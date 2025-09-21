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
import {ShiftModel} from "../models/ShiftModel";

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
                await this.earningRepo.update(e.id, {chatterId: shift.chatterId});
                updated++;
            }
        }
        return {created, updated};
    }

    /**
     * Creates a new employee earning record.
     * @param data Earning details.
     */
    public async create(data: { chatterId: number | null; modelId: number | null; date: Date; amount: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel> {
        console.log(`EmployeeEarningService.create: creating earning with data ${JSON.stringify(data)}`);
        const created = await this.earningRepo.create(data);

        console.log(`EmployeeEarningService.create: created earning ${created.id}`);
        await this.refreshCommissionsForNewEarning(created);

        return created;
    }

    /**
     * Updates an existing earning record.
     * @param id Earning identifier.
     * @param data Partial earning data.
     */
    public async update(id: string, data: { chatterId?: number | null; modelId?: number | null; date?: Date; amount?: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel | null> {
        console.log(`EmployeeEarningService.update: fetching earning ${id} before update`);
        const before = await this.earningRepo.findById(id);
        if (!before) {
            console.log(`EmployeeEarningService.update: earning ${id} not found`);
            return null;
        }

        console.log(`EmployeeEarningService.update: current earning ${id} -> ${JSON.stringify(before)}`);
        console.log(`EmployeeEarningService.update: applying changes ${JSON.stringify(data)}`);
        const updated = await this.earningRepo.update(id, data);

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
        console.log(`EmployeeEarningService.refreshCommissionsForEarningChange: evaluating earning ${before.id}`);
        const shifts = new Map<number, ShiftModel>();

        const beforeShift = await this.resolveCompletedShiftForEarning(before);
        if (beforeShift) {
            console.log(`EmployeeEarningService.refreshCommissionsForEarningChange: found previous shift ${beforeShift.id}`);
            shifts.set(beforeShift.id, beforeShift);
        } else {
            console.log("EmployeeEarningService.refreshCommissionsForEarningChange: no previous completed shift found");
        }

        const afterShift = await this.resolveCompletedShiftForEarning(after);

        if (afterShift) {
            console.log(`EmployeeEarningService.refreshCommissionsForEarningChange: found new shift ${afterShift.id}`);
            shifts.set(afterShift.id, afterShift);
        } else {
            console.log("EmployeeEarningService.refreshCommissionsForEarningChange: no new completed shift found");
        }

        for (const shift of shifts.values()) {
            console.log(`EmployeeEarningService.refreshCommissionsForEarningChange: recalculating commission for shift ${shift.id}`);
            await this.commissionService.recalculateCommissionForShift(shift);
        }
    }

    private async refreshCommissionsForNewEarning(earning: EmployeeEarningModel): Promise<void> {
        console.log(`EmployeeEarningService.refreshCommissionsForNewEarning: resolving shift for earning ${earning.id}`);
        const shift = await this.resolveCompletedShiftForEarning(earning);
        if (!shift) {
            console.log("EmployeeEarningService.refreshCommissionsForNewEarning: no completed shift found");
            return;
        }

        console.log(`EmployeeEarningService.refreshCommissionsForNewEarning: recalculating commission for shift ${shift.id}`);
        await this.commissionService.recalculateCommissionForShift(shift);
    }

    private async resolveCompletedShiftForEarning(earning: EmployeeEarningModel): Promise<ShiftModel | null> {
        console.log(`EmployeeEarningService.resolveCompletedShiftForEarning: resolving for earning ${earning.id}`);
        if (!earning.chatterId) {
            console.log("EmployeeEarningService.resolveCompletedShiftForEarning: earning has no chatterId");
            return null;
        }

        const earningDate = earning.date instanceof Date ? earning.date.toISOString() : String(earning.date);
        console.log(`EmployeeEarningService.resolveCompletedShiftForEarning: finding shift for chatter ${earning.chatterId} at ${earningDate}`);
        const shift = await this.shiftRepo.findShiftForChatterAt(earning.chatterId, earning.date);

        if (shift && shift.status === "completed") {
            console.log(`EmployeeEarningService.resolveCompletedShiftForEarning: found matching completed shift ${shift.id}`);
            return shift;
        }

        console.log("EmployeeEarningService.resolveCompletedShiftForEarning: no direct completed shift, searching closest completed shift");
        const closest = await this.shiftRepo.findClosestCompletedShiftForChatter(earning.chatterId, earning.date);
        if (!closest || closest.status !== "completed") {
            console.log("EmployeeEarningService.resolveCompletedShiftForEarning: no completed shift found in proximity");
            return null;
        }

        console.log(`EmployeeEarningService.resolveCompletedShiftForEarning: using closest completed shift ${closest.id}`);
        return closest;
    }
}
