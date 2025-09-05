import {inject, injectable} from "tsyringe";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../models/EmployeeEarningModel";
import {F2FTransactionSyncService} from "./F2FTransactionSyncService";

/**
 * Service for managing employee earnings and syncing transactions.
 */
@injectable()
export class EmployeeEarningService {
    constructor(
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        private txnSync: F2FTransactionSyncService
    ) {}

    /**
     * Retrieves all employee earnings after syncing recent transactions.
     */
    public async getAll(): Promise<EmployeeEarningModel[]> {
        console.log("Syncing recent pay per message transactions...");
        await this.txnSync.syncRecentPayPerMessage().catch(console.error);
        return this.earningRepo.findAll();
    }

    /**
     * Retrieves an earning by its ID after syncing transactions.
     * @param id Earning identifier.
     */
    public async getById(id: string): Promise<EmployeeEarningModel | null> {
        await this.txnSync.syncRecentPayPerMessage().catch(console.error);
        return this.earningRepo.findById(id);
    }

    /**
     * Creates a new employee earning record.
     * @param data Earning details.
     */
    public async create(data: { chatterId: number | null; modelId: number | null; date: Date; amount: number; description?: string | null; }): Promise<EmployeeEarningModel> {
        return this.earningRepo.create(data);
    }

    /**
     * Updates an existing earning record.
     * @param id Earning identifier.
     * @param data Partial earning data.
     */
    public async update(id: string, data: { chatterId?: number | null; modelId?: number | null; date?: Date; amount?: number; description?: string | null; }): Promise<EmployeeEarningModel | null> {
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
