/**
 * RevenueService module.
 */
import {endOfDay, endOfMonth, startOfDay, startOfMonth, startOfWeek} from "date-fns";
import {toZonedTime} from "date-fns-tz";
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
        const nowZoned = toZonedTime(now, timezone);

        const effectiveFrom = params.from
            ? this.toUtcPreservingComponents(startOfDay(toZonedTime(params.from, timezone)))
            : undefined;
        const effectiveTo = params.to
            ? this.toUtcPreservingComponents(endOfDay(toZonedTime(params.to, timezone)))
            : undefined;

        const todayStart = this.toUtcPreservingComponents(startOfDay(nowZoned));
        const todayEnd = this.toUtcPreservingComponents(endOfDay(nowZoned));
        const daily = await this.earningRepo.getTotalAmount({from: todayStart, to: todayEnd});

        const monthFrom = effectiveFrom ?? this.toUtcPreservingComponents(startOfMonth(nowZoned));
        const monthTo = effectiveTo ?? this.toUtcPreservingComponents(endOfMonth(nowZoned));

        let monthly = 0;
        if (monthTo >= monthFrom) {
            monthly = await this.earningRepo.getTotalAmount({from: monthFrom, to: monthTo});
        }

        const referenceForWeekUtc = effectiveTo ?? now;
        const referenceForWeekZoned = toZonedTime(referenceForWeekUtc, timezone);
        let weekFrom = this.toUtcPreservingComponents(startOfWeek(referenceForWeekZoned, {weekStartsOn: 1}));
        if (effectiveFrom && weekFrom < effectiveFrom) {
            weekFrom = effectiveFrom;
        }

        const weekTo = effectiveTo ?? this.toUtcPreservingComponents(endOfDay(referenceForWeekZoned));

        let weekly = 0;
        if (weekTo >= weekFrom) {
            weekly = await this.earningRepo.getTotalAmount({from: weekFrom, to: weekTo});
        }

        return {daily, weekly, monthly};
    }

    private toUtcPreservingComponents(date: Date): Date {
        return new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
            date.getMilliseconds(),
        ));
    }
}
