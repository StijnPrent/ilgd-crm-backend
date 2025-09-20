import {Request, Response} from "express";
import {container} from "tsyringe";
import {AnalyticsInterval, AnalyticsService} from "../business/services/AnalyticsService";

export class AnalyticsController {
    private get service(): AnalyticsService {
        return container.resolve(AnalyticsService);
    }

    public async getEarningsProfitTrend(req: Request, res: Response): Promise<void> {
        try {
            const from = this.extractDate(req.query.from);
            const to = this.extractDate(req.query.to);
            const interval = this.extractInterval(req.query.interval);

            if (!from || !to) {
                res.status(400).send("'from' and 'to' query parameters are required in YYYY-MM-DD format");
                return;
            }

            if (!interval) {
                res.status(400).send("'interval' query parameter must be either 'day' or 'month'");
                return;
            }

            if (from > to) {
                res.status(400).send("'from' date must be before or equal to 'to'");
                return;
            }

            const timezoneInput = this.extractString(req.query.timezone);
            let effectiveTimezone = process.env.TZ ?? "UTC";
            if (timezoneInput) {
                if (!this.isValidTimezone(timezoneInput)) {
                    res.status(400).send("Invalid timezone provided");
                    return;
                }
                effectiveTimezone = timezoneInput;
            }

            const result = await this.service.getEarningsProfitTrend({
                from,
                to,
                interval,
                timezone: effectiveTimezone,
            });

            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).send("Error generating earnings and profit trend");
        }
    }

    private extractDate(value: unknown): string | undefined {
        const text = this.extractString(value);
        if (!text) return undefined;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return undefined;
        }
        return text;
    }

    private extractInterval(value: unknown): AnalyticsInterval | undefined {
        const text = this.extractString(value);
        if (text === "day" || text === "month") {
            return text;
        }
        return undefined;
    }

    private isValidTimezone(value: string): boolean {
        try {
            new Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
        } catch {
            return false;
        }
    }

    private extractString(value: unknown): string | undefined {
        if (typeof value === "string") {
            return value;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === "string") {
                    return item;
                }
            }
        }
        return undefined;
    }
}
