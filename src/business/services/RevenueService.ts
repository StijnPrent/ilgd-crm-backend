/**
 * RevenueService module.
 */
import {endOfDay, endOfMonth, startOfDay, startOfMonth, startOfWeek} from "date-fns";
import {utcToZonedTime, zonedTimeToUtc} from "date-fns-tz";
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

        const timezone = process.env.TZ ?? "UTC";
        const now = new Date();
        const nowZoned = utcToZonedTime(now, timezone);

        const effectiveFrom = params.from
            ? zonedTimeToUtc(startOfDay(utcToZonedTime(params.from, timezone)), timezone)
            : undefined;
        const effectiveTo = params.to
            ? zonedTimeToUtc(endOfDay(utcToZonedTime(params.to, timezone)), timezone)
            : undefined;

        const todayStart = zonedTimeToUtc(startOfDay(nowZoned), timezone);
        const todayEnd = zonedTimeToUtc(endOfDay(nowZoned), timezone);
        const daily = await this.earningRepo.getTotalAmount({from: todayStart, to: todayEnd});

        const monthFrom = effectiveFrom ?? zonedTimeToUtc(startOfMonth(nowZoned), timezone);
        const monthTo = effectiveTo ?? zonedTimeToUtc(endOfMonth(nowZoned), timezone);

        let monthly = 0;
        if (monthTo >= monthFrom) {
            monthly = await this.earningRepo.getTotalAmount({from: monthFrom, to: monthTo});
        }

        const referenceForWeekUtc = effectiveTo ?? now;
        const referenceForWeekZoned = utcToZonedTime(referenceForWeekUtc, timezone);
        let weekFrom = zonedTimeToUtc(startOfWeek(referenceForWeekZoned, {weekStartsOn: 1}), timezone);
        if (effectiveFrom && weekFrom < effectiveFrom) {
            weekFrom = effectiveFrom;
        }

        const weekTo = effectiveTo ?? zonedTimeToUtc(endOfDay(referenceForWeekZoned), timezone);

        let weekly = 0;
        if (weekTo >= weekFrom) {
            weekly = await this.earningRepo.getTotalAmount({from: weekFrom, to: weekTo});
        }

        return {daily, weekly, monthly};
    }
}
