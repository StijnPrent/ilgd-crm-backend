/**
 * RevenueService module.
 */
import {addDays} from "date-fns";
import {formatInTimeZone} from "date-fns-tz";
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
        const {year, month, day} = this.extractDateParts(date, timezone);
        return this.buildUtcDate(year, month, day);
    }

    private getDayEnd(date: Date, timezone: string): Date {
        const nextDayParts = this.extractDateParts(addDays(date, 1), timezone);
        const nextDayStart = this.buildUtcDate(nextDayParts.year, nextDayParts.month, nextDayParts.day);
        return new Date(nextDayStart.getTime() - 1);
    }

    private getMonthStart(date: Date, timezone: string): Date {
        const monthStr = formatInTimeZone(date, timezone, "yyyy-MM");
        const [yearStr, monthStrNum] = monthStr.split("-");
        return this.buildUtcDate(Number(yearStr), Number(monthStrNum), 1);
    }

    private getMonthEnd(date: Date, timezone: string): Date {
        const monthStr = formatInTimeZone(date, timezone, "yyyy-MM");
        const [yearStr, monthStrNum] = monthStr.split("-");
        const year = Number(yearStr);
        const month = Number(monthStrNum);
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextMonthStart = this.buildUtcDate(nextYear, nextMonth, 1);
        return new Date(nextMonthStart.getTime() - 1);
    }

    private getWeekStart(date: Date, timezone: string): Date {
        const isoDay = Number(formatInTimeZone(date, timezone, "i"));
        const daysToSubtract = isoDay - 1;
        const startCandidate = addDays(date, -daysToSubtract);
        return this.getDayStart(startCandidate, timezone);
    }
  
    private extractDateParts(date: Date, timezone: string): {year: number; month: number; day: number;} {
        const [yearStr, monthStr, dayStr] = formatInTimeZone(date, timezone, "yyyy-M-d").split("-");
        return {year: Number(yearStr), month: Number(monthStr), day: Number(dayStr)};
    }

    private buildUtcDate(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0, milliseconds = 0): Date {
        return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds));
    }
}
