/**
 * EmployeeEarningService module.
 */
import {inject, injectable} from "tsyringe";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../models/EmployeeEarningModel";
import {ChatterLeaderboardModel} from "../models/ChatterLeaderboardModel";
import {F2FTransactionSyncService} from "./F2FTransactionSyncService";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";

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
        @inject("IShiftRepository") private shiftRepo: IShiftRepository
    ) {}

    /**
     * Retrieves all employee earnings after syncing recent transactions.
     */
    public async getAll(params: {
        limit?: number;
        offset?: number;
        chatterId?: number;
        type?: string;
        date?: Date;
    } = {}): Promise<EmployeeEarningModel[]> {
        if ((params.offset ?? 0) <= 0) {
            console.log("Syncing recent F2F transactions...");
            await this.txnSync.syncRecentTransactions().catch(console.error);
        }
        return this.earningRepo.findAll(params);
    }

    public async totalCount(params: { chatterId?: number; type?: string; modelId?: number; date?: Date } = {}): Promise<number> {
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
    public async getLeaderboard(): Promise<ChatterLeaderboardModel[]> {
        await this.txnSync.syncRecentTransactions().catch(console.error);

        const now = new Date();
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = (day + 6) % 7; // Monday = 0
        startOfWeek.setDate(startOfWeek.getDate() - diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now);
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const rows = await this.earningRepo.getLeaderboard(startOfWeek, startOfMonth);
        rows.sort((a, b) => b.weekAmount - a.weekAmount);
        return rows.map((r, idx) => new ChatterLeaderboardModel(r.chatterId, r.chatterName, r.weekAmount, r.monthAmount, idx + 1));
    }

    /**
     * Syncs earnings with chatters for a given period.
     */
    public async syncWithChatters(from: Date, to: Date): Promise<number> {
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
        return updated;
    }

    /**
     * Creates a new employee earning record.
     * @param data Earning details.
     */
    public async create(data: { chatterId: number | null; modelId: number | null; date: Date; amount: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel> {
        return this.earningRepo.create(data);
    }

    /**
     * Updates an existing earning record.
     * @param id Earning identifier.
     * @param data Partial earning data.
     */
    public async update(id: string, data: { chatterId?: number | null; modelId?: number | null; date?: Date; amount?: number; description?: string | null; type?: string | null; }): Promise<EmployeeEarningModel | null> {
        return this.earningRepo.update(id, data);
    }

    /**
     * Deletes an earning record.
     * @param id Earning identifier.
     */
    public async delete(id: string): Promise<void> {
        await this.earningRepo.delete(id);
    }
}
