/**
 * EmployeeEarningController module.
 */
import {Request, Response} from "express";
import {container} from "tsyringe";
import {EmployeeEarningService} from "../business/services/EmployeeEarningService";

/**
 * Controller managing employee earnings.
 */
/**
 * EmployeeEarningController class.
 */
export class EmployeeEarningController {
    private get service(): EmployeeEarningService {
        return container.resolve(EmployeeEarningService);
    }

    /**
     * Retrieves all employee earnings.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getAll(req: Request, res: Response): Promise<void> {
        try {
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const offset = req.query.offset ? Number(req.query.offset) : undefined;
            const chatterId = req.query.chatterId ? Number(req.query.chatterId) : undefined;
            const modelId = req.query.modelId ? Number(req.query.modelId) : undefined;
            const shiftIdStr = this.extractString(req.query.shiftId);
            let shiftId: number | undefined;
            if (shiftIdStr !== undefined) {
                shiftId = Number(shiftIdStr);
                if (Number.isNaN(shiftId)) {
                    res.status(400).send("Invalid shiftId");
                    return;
                }
            }
            const typeValues = this.extractStringArray(req.query.type);
            let types: string[] | undefined;
            if (typeValues) {
                const normalized = new Set<string>();
                for (const value of typeValues) {
                    for (const part of value.split(",")) {
                        const trimmed = part.trim();
                        if (trimmed) {
                            normalized.add(trimmed);
                        }
                    }
                }
                if (normalized.size) {
                    types = Array.from(normalized);
                }
            }
            const dateStr = this.extractString(req.query.date);
            let date: Date | undefined;
            if (dateStr) {
                date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    res.status(400).send("Invalid date");
                    return;
                }
            }
            const fromStr = this.extractString(req.query.from);
            let from: Date | undefined;
            if (fromStr) {
                from = new Date(fromStr);
                if (isNaN(from.getTime())) {
                    res.status(400).send("Invalid from date");
                    return;
                }
                if (this.isDateOnly(fromStr.trim())) {
                    from.setUTCHours(0, 0, 0, 0);
                }
            }
            const toStr = this.extractString(req.query.to);
            console.log(toStr)
            let to: Date | undefined;
            if (toStr) {
                to = new Date(toStr);
                if (isNaN(to.getTime())) {
                    res.status(400).send("Invalid to date");
                    return;
                }
                if (this.isDateOnly(toStr.trim())) {
                    to.setUTCHours(23, 59, 59, 999);
                }
            }
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }

            const earnings = await this.service.getAll({limit, offset, chatterId, types, date, from, to, shiftId, modelId});
            res.json(earnings.map(e => e.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching earnings");
        }
    }

    /**
     * Retrieves the total count of employee earnings.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async totalCount(req: Request, res: Response): Promise<void> {
        try {
            const chatterId = req.query.chatterId ? Number(req.query.chatterId) : undefined;
            const typeValues = this.extractStringArray(req.query.type);
            let types: string[] | undefined;
            if (typeValues) {
                const normalized = new Set<string>();
                for (const value of typeValues) {
                    for (const part of value.split(",")) {
                        const trimmed = part.trim();
                        if (trimmed) {
                            normalized.add(trimmed);
                        }
                    }
                }
                if (normalized.size) {
                    types = Array.from(normalized);
                }
            }
            const modelIdStr = this.extractString(req.query.modelId);
            let modelId: number | undefined;
            if (modelIdStr !== undefined) {
                modelId = Number(modelIdStr);
                if (Number.isNaN(modelId)) {
                    res.status(400).send("Invalid modelId");
                    return;
                }
            }
            const shiftIdStr = this.extractString(req.query.shiftId);
            let shiftId: number | undefined;
            if (shiftIdStr !== undefined) {
                shiftId = Number(shiftIdStr);
                if (Number.isNaN(shiftId)) {
                    res.status(400).send("Invalid shiftId");
                    return;
                }
            }
            const dateStr = this.extractString(req.query.date);
            let date: Date | undefined;
            if (dateStr) {
                date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    res.status(400).send("Invalid date");
                    return;
                }
            }
            const fromStr = this.extractString(req.query.from);
            let from: Date | undefined;
            if (fromStr) {
                from = new Date(fromStr);
                if (isNaN(from.getTime())) {
                    res.status(400).send("Invalid from date");
                    return;
                }
                if (this.isDateOnly(fromStr.trim())) {
                    from.setUTCHours(0, 0, 0, 0);
                }
            }
            const toStr = this.extractString(req.query.to);
            let to: Date | undefined;
            if (toStr) {
                to = new Date(toStr);
                if (isNaN(to.getTime())) {
                    res.status(400).send("Invalid to date");
                    return;
                }
                if (this.isDateOnly(toStr.trim())) {
                    to.setUTCHours(23, 59, 59, 999);
                }
            }
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }
            const total = await this.service.totalCount({chatterId, types, modelId, date, from, to, shiftId});
            res.json(total);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching total count of earnings");
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

    private extractStringArray(value: unknown): string[] | undefined {
        const result: string[] = [];
        if (typeof value === "string") {
            if (value.length) {
                result.push(value);
            }
        } else if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === "string" && item.length) {
                    result.push(item);
                }
            }
        }
        return result.length ? result : undefined;
    }

    private resolveDateInput(...candidates: unknown[]): string | Date | undefined {
        for (const candidate of candidates) {
            if (candidate === undefined || candidate === null) {
                continue;
            }

            if (candidate instanceof Date) {
                if (!isNaN(candidate.getTime())) {
                    return candidate;
                }
                continue;
            }

            if (typeof candidate === "number" && Number.isFinite(candidate)) {
                const asDate = new Date(candidate);
                if (!isNaN(asDate.getTime())) {
                    return asDate;
                }
                continue;
            }

            const str = this.extractString(candidate);
            if (str !== undefined) {
                if (!str.trim()) {
                    continue;
                }
                return str;
            }
        }

        return undefined;
    }

    private parseDateInput(value: string | Date, options: {endOfDay?: boolean} = {}): Date | undefined {
        if (value instanceof Date) {
            if (isNaN(value.getTime())) {
                return undefined;
            }
            return new Date(value.getTime());
        }

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

    /**
     * Retrieves earnings for a specific chatter.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getByChatter(req: Request, res: Response): Promise<void> {
        try {
            const chatterId = Number(req.params.id);
            const earnings = await this.service.getByChatter(chatterId);
            res.json(earnings.map(e => e.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching earnings for chatter");
        }
    }

    /**
     * Retrieves leaderboard data per chatter.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getLeaderboard(req: Request, res: Response): Promise<void> {
        try {
            const fromStr = this.extractString(req.query.from);
            let from: Date | undefined;
            if (fromStr) {
                from = new Date(fromStr);
                if (isNaN(from.getTime())) {
                    res.status(400).send("Invalid from date");
                    return;
                }
            }
            const toStr = this.extractString(req.query.to);
            let to: Date | undefined;
            if (toStr) {
                to = new Date(toStr);
                if (isNaN(to.getTime())) {
                    res.status(400).send("Invalid to date");
                    return;
                }
            }
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }
            const data = await this.service.getLeaderboard({from, to});
            res.json(data.map(d => d.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching leaderboard");
        }
    }

    /**
     * Retrieves an earning by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const earning = await this.service.getById(id);
            if (!earning) {
                res.status(404).send("Earning not found");
                return;
            }
            res.json(earning.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching earning");
        }
    }

    /**
     * Syncs earnings with chatters for a specified date range.
     */
    public async sync(req: Request, res: Response): Promise<void> {
        try {
            const fromInput = this.resolveDateInput(req.query?.from, req.body?.from);
            const toInput = this.resolveDateInput(req.query?.to, req.body?.to);

            const from = fromInput ? this.parseDateInput(fromInput) : undefined;
            const to = toInput ? this.parseDateInput(toInput, {endOfDay: true}) : undefined;

            if (!from || !to) {
                res.status(400).send("Invalid 'from' or 'to' date");
                return;
            }

            if (from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }
            const result = await this.service.syncWithChatters(from, to);
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error syncing earnings with chatters");
        }
    }

    /**
     * Creates a new employee earning record.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async create(req: Request, res: Response): Promise<void> {
        try {
            const earning = await this.service.create(req.body);
            res.status(201).json(earning.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating earning");
        }
    }

    /**
     * Updates an existing earning.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const earning = await this.service.update(id, req.body);
            if (!earning) {
                res.status(404).send("Earning not found");
                return;
            }
            res.json(earning.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating earning");
        }
    }

    /**
     * Deletes an earning by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            await this.service.delete(id);
            res.sendStatus(204);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error deleting earning");
        }
    }
}
