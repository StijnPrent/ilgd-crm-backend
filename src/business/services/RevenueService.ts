import {inject, injectable} from "tsyringe";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {F2FTransactionSyncService} from "./F2FTransactionSyncService";

@injectable()
export class RevenueService {
    constructor(
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        private txnSync: F2FTransactionSyncService,
    ) {}

    public async getEarnings(): Promise<{ id: string; amount: number; modelId: number | null; modelCommissionRate: number | null; chatterId: number | null; chatterCommissionRate: number | null; }[]> {
        await this.txnSync.syncRecentPayPerMessage().catch(console.error);
        return this.earningRepo.findAllWithCommissionRates();
    }
}
