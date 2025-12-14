/**
 * RevenueService module.
 */
import {addDays, endOfDay, startOfDay} from "date-fns";
import {formatInTimeZone, fromZonedTime, toZonedTime} from "date-fns-tz";
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
        await this.syncRecentTransactions("getEarnings");
        return await this.earningRepo.findAllWithCommissionRates(params);
    }

    public async getStats(params: {from?: Date; to?: Date; timezone?: string;} = {}): Promise<{daily: number; weekly: number; monthly: number;}> {
        await this.syncRecentTransactions("getStats");

        const timezone = params.timezone ?? process.env.TZ ?? "Europe/Amsterdam";
        const now = new Date();

        const effectiveFrom = params.from ? this.getDayStart(params.from, timezone) : undefined;
        const effectiveTo = params.to ? this.getDayEnd(params.to, timezone) : undefined;

        // Daily should always reflect "today" in the resolved timezone, regardless of the query range.
        const dayStart = this.getDayStart(now, timezone);
        const dayEnd = this.getDayEnd(now, timezone);
        const daily = await this.earningRepo.getTotalAmount({from: dayStart, to: dayEnd});

        const monthFrom = effectiveFrom ?? this.getMonthStart(now, timezone);
        const monthTo = effectiveTo ?? this.getMonthEnd(now, timezone);

        let monthly = 0;
        if (monthTo >= monthFrom) {
            monthly = await this.earningRepo.getTotalAmount({from: monthFrom, to: monthTo});
        }

        const referenceForWeek = effectiveTo ?? now;
        let weekFrom = this.getWeekStart(referenceForWeek, timezone);
        if (effectiveFrom && weekFrom < effectiveFrom) {
            weekFrom = effectiveFrom;
        }

        const weekTo = effectiveTo ?? this.getDayEnd(referenceForWeek, timezone);

        let weekly = 0;
        if (weekTo >= weekFrom) {
            weekly = await this.earningRepo.getTotalAmount({from: weekFrom, to: weekTo});
        }

        return {daily, weekly, monthly};
    }

    private async syncRecentTransactions(context: string): Promise<void> {
        try {
            await this.txnSync.syncRecentTransactions();
        } catch (err) {
            console.error(`RevenueService.${context}: failed to sync recent transactions`, err);
            throw err;
        }
    }

    private getDayStart(date: Date, timezone: string): Date {
        const zoned = toZonedTime(date, timezone);
        return fromZonedTime(startOfDay(zoned), timezone);
    }

    private getDayEnd(date: Date, timezone: string): Date {
        const zoned = toZonedTime(date, timezone);
        return fromZonedTime(endOfDay(zoned), timezone);
    }

    private getMonthStart(date: Date, timezone: string): Date {
        const zoned = toZonedTime(date, timezone);
        const start = new Date(zoned);
        start.setDate(1);
        return this.getDayStart(start, timezone);
    }

    private getMonthEnd(date: Date, timezone: string): Date {
        const zoned = toZonedTime(date, timezone);
        const end = new Date(zoned);
        end.setMonth(end.getMonth() + 1, 1);
        end.setHours(0, 0, 0, 0);
        return new Date(this.getDayStart(end, timezone).getTime() - 1);
    }

    private getWeekStart(date: Date, timezone: string): Date {
        const zoned = toZonedTime(date, timezone);
        const isoDay = Number(formatInTimeZone(zoned, timezone, "i"));
        const startCandidate = addDays(zoned, -(isoDay - 1));
        return fromZonedTime(startOfDay(startCandidate), timezone);
    }
}
