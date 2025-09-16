/**
 * CommissionController module.
 */
import { Request, Response } from "express";
import { container } from "tsyringe";
import { CommissionService } from "../business/services/CommissionService";

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
            if (from && to && from > to) {
                res.status(400).send("'from' date must be before 'to' date");
                return;
            }

            const filters = { limit, offset, chatterId, date, from, to };
            const [commissions, total] = await Promise.all([
                this.service.getAll(filters),
                this.service.totalCount({ chatterId, date, from, to }),
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
            const total = await this.service.totalCount({ chatterId, date, from, to });
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
     * Retrieves a commission by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const commission = await this.service.getById(id);
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
            const commission = await this.service.create(req.body);
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
            const commission = await this.service.update(id, req.body);
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
            await this.service.delete(id);
            res.sendStatus(204);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error deleting commission");
        }
    }
}

class ValidationError extends Error {}
