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
            const type = req.query.type ? String(req.query.type) : undefined;
            const dateStr = req.query.date ? String(req.query.date) : undefined;
            let date: Date | undefined;
            if (dateStr) {
                date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    res.status(400).send("Invalid date");
                    return;
                }
            }
            const earnings = await this.service.getAll({limit, offset, chatterId, type, date});
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
            const type = req.query.type ? String(req.query.type) : undefined;
            const modelId = req.query.modelId ? Number(req.query.modelId) : undefined;
            const dateStr = req.query.date ? String(req.query.date) : undefined;
            let date: Date | undefined;
            if (dateStr) {
                date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    res.status(400).send("Invalid date");
                    return;
                }
            }
            const total = await this.service.totalCount({chatterId, type, modelId, date});
            res.json(total);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching total count of earnings");
        }
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
     * @param _req Express request object.
     * @param res Express response object.
     */
    public async getLeaderboard(_req: Request, res: Response): Promise<void> {
        try {
            const data = await this.service.getLeaderboard();
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
            const fromStr = String(req.query.from || req.body.from || "");
            const toStr = String(req.query.to || req.body.to || "");
            const from = new Date(fromStr);
            const to = new Date(toStr);
            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                res.status(400).send("Invalid 'from' or 'to' date");
                return;
            }
            const updated = await this.service.syncWithChatters(from, to);
            res.json({updated});
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
