import {injectable} from "tsyringe";
import {RevenueService} from "./RevenueService";
import {formatInTimeZone, fromZonedTime, toZonedTime} from "date-fns-tz";
import {addDays, addMonths, isAfter, startOfDay, startOfMonth} from "date-fns";

export type AnalyticsInterval = "day" | "month";

export interface EarningsProfitTrendPoint {
    key: string;
    label: string;
    tooltipLabel: string;
    earnings: number;
    profit: number;
}

export interface EarningsProfitTrendResult {
    range: string;
    interval: AnalyticsInterval;
    from: string;
    to: string;
    points: EarningsProfitTrendPoint[];
    totals: {
        earnings: number;
        profit: number;
    };
}

interface EarningsProfitTrendParams {
    from: string;
    to: string;
    interval: AnalyticsInterval;
    timezone: string;
}

@injectable()
export class AnalyticsService {
    constructor(private revenueService: RevenueService) {}

    public async getEarningsProfitTrend(params: EarningsProfitTrendParams): Promise<EarningsProfitTrendResult> {
        const {from, to, interval, timezone} = params;

        const fromUtc = fromZonedTime(`${from}T00:00:00`, timezone);
        const toUtc = fromZonedTime(`${to}T23:59:59.999`, timezone);

        if (fromUtc > toUtc) {
            throw new Error("'from' date must be before or equal to 'to'");
        }

        const {points, map} = this.buildBuckets({fromUtc, toUtc, interval, timezone});

        const earnings = await this.revenueService.getEarnings({from: fromUtc, to: toUtc});

        for (const record of earnings) {
            const bucketKey = this.getBucketKey(record.date, interval, timezone);
            const bucket = map.get(bucketKey);
            if (!bucket) continue;

            const amount = Number(record.amount ?? 0);
            bucket.earnings += amount;

            const platformFeeRate = Number(record.platformFeeRate ?? 0);
            const net = amount * (1 - platformFeeRate / 100);
            const modelCommissionRate = Number(record.modelCommissionRate ?? 0);
            const chatterCommissionRate = Number(record.chatterCommissionRate ?? 0);
            const modelCommission = net * (modelCommissionRate / 100);
            const chatterCommission = net * (chatterCommissionRate / 100);
            const profit = net - modelCommission - chatterCommission;
            bucket.profit += profit;
        }

        let totalEarnings = 0;
        let totalProfit = 0;
        for (const point of points) {
            point.earnings = Number(point.earnings.toFixed(2));
            point.profit = Number(point.profit.toFixed(2));
            totalEarnings += point.earnings;
            totalProfit += point.profit;
        }

        const range = this.deriveRange(interval, points.length);

        return {
            range,
            interval,
            from,
            to,
            points,
            totals: {
                earnings: Number(totalEarnings.toFixed(2)),
                profit: Number(totalProfit.toFixed(2)),
            },
        };
    }

    private buildBuckets(params: {
        fromUtc: Date;
        toUtc: Date;
        interval: AnalyticsInterval;
        timezone: string;
    }): {points: EarningsProfitTrendPoint[]; map: Map<string, EarningsProfitTrendPoint>;} {
        const {fromUtc, toUtc, interval, timezone} = params;
        const points: EarningsProfitTrendPoint[] = [];
        const map = new Map<string, EarningsProfitTrendPoint>();

        if (interval === "day") {
            let cursorZoned = startOfDay(toZonedTime(fromUtc, timezone));
            const endZoned = startOfDay(toZonedTime(toUtc, timezone));

            while (!isAfter(cursorZoned, endZoned)) {
                const cursorUtc = fromZonedTime(cursorZoned, timezone);
                const key = this.getBucketKey(cursorUtc, interval, timezone);
                const point: EarningsProfitTrendPoint = {
                    key,
                    label: formatInTimeZone(cursorUtc, timezone, "d"),
                    tooltipLabel: formatInTimeZone(cursorUtc, timezone, "d MMM yyyy"),
                    earnings: 0,
                    profit: 0,
                };
                points.push(point);
                map.set(key, point);
                cursorZoned = addDays(cursorZoned, 1);
            }
        } else {
            let cursorZoned = startOfMonth(toZonedTime(fromUtc, timezone));
            const endZoned = startOfMonth(toZonedTime(toUtc, timezone));

            while (!isAfter(cursorZoned, endZoned)) {
                const cursorUtc = fromZonedTime(cursorZoned, timezone);
                const key = this.getBucketKey(cursorUtc, interval, timezone);
                const point: EarningsProfitTrendPoint = {
                    key,
                    label: formatInTimeZone(cursorUtc, timezone, "MMM"),
                    tooltipLabel: formatInTimeZone(cursorUtc, timezone, "MMM yyyy"),
                    earnings: 0,
                    profit: 0,
                };
                points.push(point);
                map.set(key, point);
                cursorZoned = addMonths(cursorZoned, 1);
            }
        }

        return {points, map};
    }

    private getBucketKey(date: Date, interval: AnalyticsInterval, timezone: string): string {
        if (interval === "day") {
            return formatInTimeZone(date, timezone, "yyyy-MM-dd");
        }
        return formatInTimeZone(date, timezone, "yyyy-MM-01");
    }

    private deriveRange(interval: AnalyticsInterval, bucketCount: number): string {
        if (interval === "day") {
            if (bucketCount <= 7) {
                return "week";
            }
            if (bucketCount <= 31) {
                return "month";
            }
        } else if (bucketCount <= 12) {
            return "year";
        }
        return "custom";
    }
}
