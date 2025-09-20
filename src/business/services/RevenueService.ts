/**
 * RevenueService module.
 */
import {inject, injectable} from "tsyringe";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {F2FTransactionSyncService} from "./F2FTransactionSyncService";
import {RevenueModel} from "../models/RevenueModel";

@injectable()
/**
 * RevenueService class.
 */
export class RevenueService {
    constructor(
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        private txnSync: F2FTransactionSyncService,
    ) {}

    public async getEarnings(params: {from?: Date; to?: Date;} = {}): Promise<RevenueModel[]> {
        await this.txnSync.syncRecentTransactions().catch(console.error);
        return await this.earningRepo.findAllWithCommissionRates(params);
    }

    public async getStats(params: {from?: Date; to?: Date;} = {}): Promise<{daily: number; weekly: number; monthly: number;}> {
        await this.txnSync.syncRecentTransactions().catch(console.error);

        const now = new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const daily = await this.earningRepo.getTotalAmount({from: todayStart, to: todayEnd});

        const monthFrom = params.from ? new Date(params.from) : new Date(now);
        if (!params.from) {
            monthFrom.setDate(1);
        }
        monthFrom.setHours(0, 0, 0, 0);

        const monthTo = params.to ? new Date(params.to) : new Date(now);
        if (!params.to) {
            monthTo.setMonth(monthTo.getMonth() + 1);
            monthTo.setDate(0);
        }
        monthTo.setHours(23, 59, 59, 999);

        let monthly = 0;
        if (monthTo >= monthFrom) {
            monthly = await this.earningRepo.getTotalAmount({from: monthFrom, to: monthTo});
        }

        const referenceForWeek = params.to ? new Date(params.to) : new Date(now);
        const weekFrom = new Date(referenceForWeek);
        const day = weekFrom.getDay();
        const diff = (day + 6) % 7; // Monday as start of week
        weekFrom.setDate(weekFrom.getDate() - diff);
        weekFrom.setHours(0, 0, 0, 0);
        if (params.from && weekFrom < params.from) {
            weekFrom.setTime(new Date(params.from).getTime());
        }

        const weekTo = params.to ? new Date(params.to) : new Date(now);
        weekTo.setHours(23, 59, 59, 999);

        let weekly = 0;
        if (weekTo >= weekFrom) {
            weekly = await this.earningRepo.getTotalAmount({from: weekFrom, to: weekTo});
        }

        return {daily, weekly, monthly};
    }
}
