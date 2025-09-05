import {Request, Response} from "express";
import {container} from "tsyringe";
import {ShiftService} from "../business/services/ShiftService";
import {ShiftModel} from "../business/models/ShiftModel";

/**
 * Controller handling shift scheduling and tracking.
 */
export class ShiftController {
    private get service(): ShiftService {
        return container.resolve(ShiftService);
    }

    /**
     * Retrieves all shifts.
     * @param _req Express request object.
     * @param res Express response object.
     */
    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const shifts = await this.service.getAll();
            res.json(shifts.map(s => s.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching shifts");
        }
    }

    /**
     * Retrieves a shift by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const shift = await this.service.getById(id);
            if (!shift) {
                res.status(404).send("Shift not found");
                return;
            }
            res.json(shift.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching shift");
        }
    }

    /**
     * Creates a new shift.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async create(req: Request, res: Response): Promise<void> {
        try {
            const {date, start_time, end_time, modelIds, chatterId, status} = req.body;

            const baseDate = new Date(date);
            const parseTime = (t: any): Date | null => {
                if (!t && t !== 0) return null;
                if (typeof t === "string") {
                    if (t.includes("T")) return new Date(t);
                    return new Date(`${date}T${t}`);
                }
                return new Date(t);
            };

            const start = parseTime(start_time);
            let end = parseTime(end_time);
            if (start && end && end <= start) {
                end.setDate(end.getDate() + 1);
            }

            const data = {
                chatterId: Number(chatterId),
                modelIds: Array.isArray(modelIds) ? modelIds.map((n: any) => Number(n)) : [],
                date: baseDate,
                start_time: start!,
                end_time: end,
                status,
            };

            const shift = await this.service.create(data);
            res.status(201).json(shift.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating shift");
        }
    }

    /**
     * Clocks in a chatter and models to start a shift.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async clockIn(req: Request, res: Response): Promise<void> {
        try {
            const {chatterId, modelIds} = req.body;
            const shift = await this.service.clockIn(
                Number(chatterId),
                Array.isArray(modelIds) ? modelIds.map((n: any) => Number(n)) : []
            );
            res.status(201).json(shift.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error clocking in");
        }
    }

    /**
     * Clocks out an active shift.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async clockOut(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const shift = await this.service.clockOut(id);
            if (!shift) {
                res.status(404).send("Shift not found");
                return;
            }
            res.json(shift.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error clocking out");
        }
    }

    /**
     * Updates a shift record.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const {date, start_time, end_time, modelIds, chatterId, status} = req.body;

            const result: any = {};
            if (chatterId !== undefined) result.chatterId = Number(chatterId);
            if (Array.isArray(modelIds)) result.modelIds = modelIds.map((n: any) => Number(n));
            if (date) result.date = new Date(date);

            const parseTime = (t: any): Date | null => {
                if (t === undefined || t === null) return null;
                if (typeof t === "string") {
                    if (t.includes("T")) return new Date(t);
                    if (date) return new Date(`${date}T${t}`);
                    return new Date(t);
                }
                return new Date(t);
            };

            const start = parseTime(start_time);
            let end = parseTime(end_time);
            if (start) result.start_time = start;
            if (start && end && end <= start) {
                end.setDate(end.getDate() + 1);
            }
            if (end !== null) result.end_time = end;
            if (status) result.status = status;

            const shift = await this.service.update(id, result);
            if (!shift) {
                res.status(404).send("Shift not found");
                return;
            }
            res.json(shift.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating shift");
        }
    }

    /**
     * Deletes a shift by ID.
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
            res.status(500).send("Error deleting shift");
        }
    }

    /**
     * Retrieves the active time entry for a chatter.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getActiveTimeEntry(req: Request, res: Response): Promise<void> {
        try {
            const chatterId = Number(req.params.chatterId);
            const entry = await this.service.getActiveTimeEntry(chatterId);
            if (!entry) {
                res.status(404).send("No active time entry found");
                return;
            }
            res.json(entry);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching active time entry");
        }
    }
}
