/**
 * CommissionController module.
 */
import { Request, Response } from "express";
import { container } from "tsyringe";
import { CommissionService } from "../business/services/CommissionService";
import { CommissionModel } from "../business/models/CommissionModel";
import { AuthenticatedRequest } from "../middleware/auth";

type CommissionJSON = ReturnType<CommissionModel["toJSON"]>;

type CommissionAggregates = {
    earnings: number;
    commissions: number;
    totals: number;
};

type GroupByDayFilters = {
    from?: Date;
    to?: Date;
    date?: Date;
};

type GroupedDayEntry = {
    day: string;
    commissions: CommissionJSON[];
    aggregates: CommissionAggregates;
};

type GroupedDayResponse = {
    data: GroupedDayEntry[];
    totals: CommissionAggregates;
};

class ValidationError extends Error {}

interface DayGroupingBucket {
    commissions: CommissionJSON[];
    aggregates: CommissionAggregates;
}

/**
 * Controller for commission CRUD operations.
 */
/**
 * CommissionController class.
 */
export class CommissionController {
    private get service(): CommissionService {
        return container.resolve(CommissionService);
    }

    private resolveCompanyId(req: Request, res: Response): number | null {
        const authReq = req as AuthenticatedRequest;
        const companyId = authReq.companyId;
        if (companyId == null || Number.isNaN(companyId)) {
            res.status(400).send("companyId is required");
            return null;
        }
        return companyId;
    }

    private parseOptionalNumber(value: unknown, field: string): number | undefined {
        if (value === undefined) return undefined;
        const raw = this.extractString(value);
        if (raw === undefined) return undefined;
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
            throw new ValidationError(`Invalid ${field}`);
        }
        return parsed;
    }

    private parseOptionalDate(value: unknown, field: string): Date | undefined {
        const raw = this.extractString(value);
        if (!raw) return undefined;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            throw new ValidationError(`Invalid ${field}`);
        }
        return parsed;
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

    /**
     * Retrieves all commissions.
     * @param _req Express request object.
     * @param res Express response object.
     */
    public async getAll(req: Request, res: Response): Promise<void> {
        try {
            const limit = this.parseOptionalNumber(req.query.limit, "limit");
            const offset = this.parseOptionalNumber(req.query.offset, "offset");
            const chatterId = this.parseOptionalNumber(req.query.chatterId, "chatterId");
            const date = this.parseOptionalDate(req.query.date, "date");
            const from = this.parseOptionalDate(req.query.from, "from");
            const to = this.parseOptionalDate(req.query.to, "to");
            const groupBy = this.extractString(req.query.groupBy);
            if (groupBy && groupBy !== "day") {
                res.status(400).send("Unsupported groupBy value");
                return;
            }
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }

            const companyId = this.resolveCompanyId(req, res);
            if (companyId === null) {
                return;
            }
            const baseFilters = { companyId, chatterId, date, from, to };

            if (groupBy === "day") {
                const commissions = await this.service.getAll(baseFilters);
                const grouped = this.groupCommissionsByDay(commissions, { from, to, date });
                res.json(grouped);
                return;
            }

            const filters = { ...baseFilters, limit, offset };
            const [commissions, total] = await Promise.all([
                this.service.getAll(filters),
                this.service.totalCount(baseFilters),
            ]);
            res.json({
                data: commissions.map(c => c.toJSON()),
                meta: {
                    total,
                    limit: limit ?? commissions.length,
                    offset: offset ?? 0,
                },
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                res.status(400).send(err.message);
                return;
            }
            console.error(err);
            res.status(500).send("Error fetching commissions");
        }
    }

    /**
     * Retrieves the total count for commissions matching filters.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getTotalCount(req: Request, res: Response): Promise<void> {
        try {
            const chatterId = this.parseOptionalNumber(req.query.chatterId, "chatterId");
            const date = this.parseOptionalDate(req.query.date, "date");
            const from = this.parseOptionalDate(req.query.from, "from");
            const to = this.parseOptionalDate(req.query.to, "to");
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }
            const companyId = this.resolveCompanyId(req, res);
            if (companyId === null) {
                return;
            }
            const total = await this.service.totalCount({ companyId, chatterId, date, from, to });
            res.json({ total });
        } catch (err) {
            if (err instanceof ValidationError) {
                res.status(400).send(err.message);
                return;
            }
            console.error(err);
            res.status(500).send("Error fetching commission count");
        }
    }

    /**
     * Iterates through all shifts to ensure commissions exist for each of them.
     * @param _req Express request object.
     * @param res Express response object.
     */
    public async updateFromShifts(_req: Request, res: Response): Promise<void> {
        try {
            const summary = await this.service.updateAllFromShifts();
            res.json({
                message: "Commission update completed",
                ...summary,
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating commissions from shifts");
        }
    }

    /**
     * Retrieves a commission by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const companyId = this.resolveCompanyId(req, res);
            if (companyId === null) {
                return;
            }
            const commission = await this.service.getById(id, companyId);
            if (!commission) {
                res.status(404).send("Commission not found");
                return;
            }
            res.json(commission.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching commission");
        }
    }

    /**
     * Creates a new commission record.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async create(req: Request, res: Response): Promise<void> {
        try {
            const companyId = this.resolveCompanyId(req, res);
            if (companyId === null) {
                return;
            }
            const payload = req.body ?? {};
            const commission = await this.service.create({
                ...payload,
                companyId,
            });
            res.status(201).json(commission.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating commission");
        }
    }

    /**
     * Updates an existing commission.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const companyId = this.resolveCompanyId(req, res);
            if (companyId === null) {
                return;
            }
            const commission = await this.service.update(id, req.body, companyId);
            if (!commission) {
                res.status(404).send("Commission not found");
                return;
            }
            res.json(commission.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating commission");
        }
    }

    /**
     * Deletes a commission record.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const companyId = this.resolveCompanyId(req, res);
            if (companyId === null) {
                return;
            }
            await this.service.delete(id, companyId);
            res.sendStatus(204);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error deleting commission");
        }
    }

    private groupCommissionsByDay(commissions: CommissionModel[], filters: GroupByDayFilters): GroupedDayResponse {
        const buckets = new Map<string, DayGroupingBucket>();
        const totals = this.createEmptyAggregates();

        for (const commission of commissions) {
            const key = this.dateKeyFromUnknown(commission.commissionDate);
            if (!key) {
                continue;
            }
            const json = commission.toJSON();
            const bucket = this.getOrCreateBucket(buckets, key);
            bucket.commissions.push(json);
            this.accumulateAggregates(bucket.aggregates, json);
            this.accumulateAggregates(totals, json);
        }

        const orderedKeys = Array.from(buckets.keys()).sort();
        let startKey = filters.from ? this.dateKeyFromUnknown(filters.from) : undefined;
        let endKey = filters.to ? this.dateKeyFromUnknown(filters.to) : undefined;
        const dateKey = filters.date ? this.dateKeyFromUnknown(filters.date) : undefined;

        if (!startKey && dateKey) {
            startKey = dateKey;
        }
        if (!endKey && dateKey) {
            endKey = dateKey;
        }
        if (!startKey && orderedKeys.length) {
            startKey = orderedKeys[0];
        }
        if (!endKey && orderedKeys.length) {
            endKey = orderedKeys[orderedKeys.length - 1];
        }
        if (startKey && !endKey) {
            endKey = orderedKeys.length ? orderedKeys[orderedKeys.length - 1] : startKey;
        }
        if (!startKey && endKey) {
            startKey = orderedKeys.length ? orderedKeys[0] : endKey;
        }

        if (!startKey || !endKey) {
            return { data: [], totals };
        }

        const data: GroupedDayEntry[] = [];
        let cursor = this.dateFromKey(startKey);
        const endDate = this.dateFromKey(endKey);

        while (cursor <= endDate) {
            const dayKey = this.formatDateKey(cursor);
            const bucket = buckets.get(dayKey);
            data.push({
                day: dayKey,
                commissions: bucket?.commissions ?? [],
                aggregates: bucket ? bucket.aggregates : this.createEmptyAggregates(),
            });
            cursor = this.addDays(cursor, 1);
        }

        return { data, totals };
    }

    private getOrCreateBucket(buckets: Map<string, DayGroupingBucket>, key: string): DayGroupingBucket {
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = { commissions: [], aggregates: this.createEmptyAggregates() };
            buckets.set(key, bucket);
        }
        return bucket;
    }

    private createEmptyAggregates(): CommissionAggregates {
        return { earnings: 0, commissions: 0, totals: 0 };
    }

    private accumulateAggregates(target: CommissionAggregates, row: CommissionJSON): void {
        target.earnings += Number(row.earnings ?? 0);
        target.commissions += Number(row.commission ?? 0);
        target.totals += Number(row.totalPayout ?? 0);
    }

    private dateKeyFromUnknown(value: unknown): string | undefined {
        const date = this.ensureDate(value);
        if (!date) return undefined;
        return this.formatDateKey(date);
    }

    private ensureDate(value: unknown): Date | undefined {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value;
        }
        if (typeof value === "string" || typeof value === "number") {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return undefined;
    }

    private formatDateKey(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private dateFromKey(key: string): Date {
        return new Date(`${key}T00:00:00.000Z`);
    }

    private addDays(date: Date, amount: number): Date {
        const clone = new Date(date.getTime());
        clone.setUTCDate(clone.getUTCDate() + amount);
        return clone;
    }
}
