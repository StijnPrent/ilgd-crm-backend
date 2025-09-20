/**
 * RevenueService module.
 */
import {addDays} from "date-fns";
import {formatInTimeZone, zonedTimeToUtc} from "date-fns-tz";
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

        const effectiveFrom = params.from ? this.getDayStart(params.from, timezone) : undefined;
        const effectiveTo = params.to ? this.getDayEnd(params.to, timezone) : undefined;

        const todayStart = this.getDayStart(now, timezone);
        const todayEnd = this.getDayEnd(now, timezone);
        const daily = await this.earningRepo.getTotalAmount({from: todayStart, to: todayEnd});

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

    private getDayStart(date: Date, timezone: string): Date {
        const dayStr = formatInTimeZone(date, timezone, "yyyy-MM-dd");
        return zonedTimeToUtc(`${dayStr}T00:00:00.000`, timezone);
    }

    private getDayEnd(date: Date, timezone: string): Date {
        const dayStr = formatInTimeZone(date, timezone, "yyyy-MM-dd");
        const nextDayStr = formatInTimeZone(addDays(date, 1), timezone, "yyyy-MM-dd");
        const nextDayStart = zonedTimeToUtc(`${nextDayStr}T00:00:00.000`, timezone);
        const sameDayEnd = zonedTimeToUtc(`${dayStr}T23:59:59.999`, timezone);
        // Use the earlier of the explicit end-of-day and the millisecond before the next day
        // to accommodate time zones with shorter days (e.g., DST transitions).
        const candidate = new Date(nextDayStart.getTime() - 1);
        return candidate < sameDayEnd ? candidate : sameDayEnd;
    }

    private getMonthStart(date: Date, timezone: string): Date {
        const monthStr = formatInTimeZone(date, timezone, "yyyy-MM");
        return zonedTimeToUtc(`${monthStr}-01T00:00:00.000`, timezone);
    }

    private getMonthEnd(date: Date, timezone: string): Date {
        const monthStr = formatInTimeZone(date, timezone, "yyyy-MM");
        const [yearStr, monthStrNum] = monthStr.split("-");
        const year = Number(yearStr);
        const month = Number(monthStrNum);
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextMonthStr = `${nextYear}-${this.padTwo(nextMonth)}`;
        const nextMonthStart = zonedTimeToUtc(`${nextMonthStr}-01T00:00:00.000`, timezone);
        return new Date(nextMonthStart.getTime() - 1);
    }

    private getWeekStart(date: Date, timezone: string): Date {
        const isoDay = Number(formatInTimeZone(date, timezone, "i"));
        const daysToSubtract = isoDay - 1;
        const startCandidate = addDays(date, -daysToSubtract);
        return this.getDayStart(startCandidate, timezone);
    }

    private padTwo(value: number): string {
        return value.toString().padStart(2, "0");
    }
}
