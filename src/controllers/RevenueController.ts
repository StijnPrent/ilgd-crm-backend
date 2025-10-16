/**
 * RevenueController module.
 */
import {Request, Response} from "express";
import {container} from "tsyringe";
import {RevenueService} from "../business/services/RevenueService";

/**
 * RevenueController class.
 */
export class RevenueController {
    private get service(): RevenueService {
        return container.resolve(RevenueService);
    }

    public async getEarnings(req: Request, res: Response): Promise<void> {
        try {
            const fromStr = this.extractString(req.query.from);
            let from: Date | undefined;
            if (fromStr) {
                from = this.parseDate(fromStr);
                if (!from) {
                    res.status(400).send("Invalid from date");
                    return;
                }
            }
            const toStr = this.extractString(req.query.to);
            let to: Date | undefined;
            if (toStr) {
                to = this.parseDate(toStr, {endOfDay: true});
                if (!to) {
                    res.status(400).send("Invalid to date");
                    return;
                }
            }
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }
            const earnings = await this.service.getEarnings({from, to});
            res.json(earnings);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching revenue earnings");
        }
    }

    public async getStats(req: Request, res: Response): Promise<void> {
        try {
            const fromStr = this.extractString(req.query.from);
            let from: Date | undefined;
            if (fromStr) {
                from = this.parseDate(fromStr);
                if (!from) {
                    res.status(400).send("Invalid from date");
                    return;
                }
            }
            const toStr = this.extractString(req.query.to);
            let to: Date | undefined;
            if (toStr) {
                to = this.parseDate(toStr, {endOfDay: true});
                if (!to) {
                    res.status(400).send("Invalid to date");
                    return;
                }
            }
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }

            const stats = await this.service.getStats({from, to});
            res.json(stats);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching revenue stats");
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

    private parseDate(value: string, options: {endOfDay?: boolean;} = {}): Date | undefined {
        const trimmed = value.trim();
        if (!trimmed) {
            return undefined;
        }

        const date = new Date(trimmed);
        if (isNaN(date.getTime())) {
            return undefined;
        }

        if (this.isDateOnly(trimmed)) {
            if (options.endOfDay) {
                date.setUTCHours(23, 59, 59, 999);
            } else {
                date.setUTCHours(0, 0, 0, 0);
            }
        }

        return date;
    }

    private isDateOnly(value: string): boolean {
        return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }
}
