import {inject, injectable} from "tsyringe";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {EmployeeEarningModel} from "../models/EmployeeEarningModel";
import {F2FTransactionSyncService} from "./F2FTransactionSyncService";

@injectable()
export class EmployeeEarningService {
    constructor(
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        private txnSync: F2FTransactionSyncService
    ) {}

    public async getAll(): Promise<EmployeeEarningModel[]> {
        console.log("Syncing recent pay per message transactions...");
        await this.txnSync.syncRecentPayPerMessage().catch(console.error);
        return this.earningRepo.findAll();
    }

    public async getById(id: string): Promise<EmployeeEarningModel | null> {
        await this.txnSync.syncRecentPayPerMessage().catch(console.error);
        return this.earningRepo.findById(id);
    }

    public async create(data: { chatterId: number; date: Date; amount: number; description?: string | null; }): Promise<EmployeeEarningModel> {
        return this.earningRepo.create(data);
    }

    public async update(id: string, data: { chatterId?: number; date?: Date; amount?: number; description?: string | null; }): Promise<EmployeeEarningModel | null> {
        return this.earningRepo.update(id, data);
    }

    public async delete(id: string): Promise<void> {
        await this.earningRepo.delete(id);
    }
}
