/**
 * ShiftController module.
 */
import {Request, Response} from "express";
import {container} from "tsyringe";
import {ShiftService} from "../business/services/ShiftService";
import {ShiftStatus} from "../rename/types";

const VALID_SHIFT_STATUSES: ShiftStatus[] = ["scheduled", "active", "completed", "cancelled"];

/**
 * Controller handling shift scheduling and tracking.
 */
/**
 * ShiftController class.
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
    public async getAll(req: Request, res: Response): Promise<void> {
        try {
            const {from, to, chatterId} = req.query;

            const parsedFrom = typeof from === "string" ? new Date(from) : undefined;
            if (parsedFrom && Number.isNaN(parsedFrom.getTime())) {
                res.status(400).send("Invalid from parameter");
                return;
            }

            const parsedTo = typeof to === "string" ? new Date(to) : undefined;
            if (parsedTo && Number.isNaN(parsedTo.getTime())) {
                res.status(400).send("Invalid to parameter");
                return;
            }

            let parsedChatterId: number | undefined;
            if (typeof chatterId === "string" && chatterId.trim() !== "") {
                parsedChatterId = Number(chatterId);
                if (Number.isNaN(parsedChatterId)) {
                    res.status(400).send("Invalid chatterId parameter");
                    return;
                }
            }

            const shifts = await this.service.getAll({
                from: parsedFrom,
                to: parsedTo,
                chatterId: parsedChatterId,
            });
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
            const repeatWeeklyRaw = req.body.repeatWeekly;
            const repeatWeekly = repeatWeeklyRaw === true || repeatWeeklyRaw === "true";
            const repeatWeeksRaw = req.body.repeatWeeks;
            const repeatWeeksNumber = repeatWeeksRaw === undefined ? 0 : Number(repeatWeeksRaw);

            if (Number.isNaN(repeatWeeksNumber) || repeatWeeksNumber < 0) {
                res.status(400).send("Invalid repeatWeeks value");
                return;
            }
            const repeatWeeks = Math.floor(repeatWeeksNumber);

            const parseDate = (value: any, field: string, allowNull = false): Date | null => {
                if (value === undefined) {
                    if (allowNull) {
                        return null;
                    }
                    throw new Error(`${field} is required`);
                }
                if (allowNull && (value === null || value === "")) {
                    return null;
                }
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) {
                    throw new Error(`Invalid ${field}`);
                }
                return date;
            };

            const parseNumber = (value: any, field: string): number => {
                if (value === undefined || value === null || value === "") {
                    throw new Error(`Invalid ${field}`);
                }
                const num = Number(value);
                if (Number.isNaN(num)) {
                    throw new Error(`Invalid ${field}`);
                }
                return num;
            };

            const chatterId = parseNumber(req.body.chatterId, "chatterId");
            const statusInput = (req.body.status ?? "scheduled") as ShiftStatus;
            if (!VALID_SHIFT_STATUSES.includes(statusInput)) {
                res.status(400).send("Invalid status");
                return;
            }
            const status = statusInput;

            const startTime = parseDate(req.body.start_time ?? req.body.startTime, "start_time");
            const date = parseDate(req.body.date, "date");
            const endTime = parseDate(req.body.end_time ?? req.body.endTime, "end_time", true);

            const modelIds = Array.isArray(req.body.modelIds)
                ? req.body.modelIds.map((n: any) => {
                    const parsed = Number(n);
                    if (Number.isNaN(parsed)) {
                        throw new Error("Invalid modelIds entry");
                    }
                    return parsed;
                })
                : [];

            const data: {
                chatterId: number;
                status: ShiftStatus;
                date: Date;
                start_time: Date;
                end_time: Date | null;
                modelIds: number[];
            } = {
                chatterId,
                status,
                date: date!,
                start_time: startTime!,
                end_time: endTime,
                modelIds,
            };

            const shift = await this.service.create(data, {repeatWeekly, repeatWeeks});
            res.status(201).json(shift.toJSON());
        } catch (err) {
            console.error(err);
            if (err instanceof Error && err.message.startsWith("Invalid")) {
                res.status(400).send(err.message);
            } else if (err instanceof Error && err.message.endsWith("required")) {
                res.status(400).send(err.message);
            } else {
                res.status(500).send("Error creating shift");
            }
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
            const data: {
                chatterId?: number;
                modelIds?: number[];
                date?: Date;
                start_time?: Date;
                end_time?: Date | null;
                status?: ShiftStatus;
            } = {};

            if (req.body.chatterId !== undefined) {
                if (req.body.chatterId === null || req.body.chatterId === "") {
                    res.status(400).send("Invalid chatterId");
                    return;
                }
                const parsedChatter = Number(req.body.chatterId);
                if (Number.isNaN(parsedChatter)) {
                    res.status(400).send("Invalid chatterId");
                    return;
                }
                data.chatterId = parsedChatter;
            }

            if (req.body.modelIds !== undefined) {
                if (!Array.isArray(req.body.modelIds)) {
                    res.status(400).send("modelIds must be an array");
                    return;
                }
                try {
                    data.modelIds = req.body.modelIds.map((n: any) => {
                        const parsed = Number(n);
                        if (Number.isNaN(parsed)) {
                            throw new Error("Invalid modelIds entry");
                        }
                        return parsed;
                    });
                } catch (error) {
                    if (error instanceof Error && error.message.startsWith("Invalid")) {
                        res.status(400).send(error.message);
                        return;
                    }
                    throw error;
                }
            }

            if (req.body.date !== undefined) {
                const parsedDate = new Date(req.body.date);
                if (Number.isNaN(parsedDate.getTime())) {
                    res.status(400).send("Invalid date");
                    return;
                }
                data.date = parsedDate;
            }

            const mapOptionalDate = (value: any, field: string, allowNull = false): Date | null | undefined => {
                if (value === undefined) {
                    return undefined;
                }
                if (allowNull && (value === null || value === "")) {
                    return null;
                }
                const parsed = new Date(value);
                if (Number.isNaN(parsed.getTime())) {
                    throw new Error(`Invalid ${field}`);
                }
                return parsed;
            };

            try {
                const startTime = mapOptionalDate(req.body.start_time ?? req.body.startTime, "start_time");
                if (startTime !== undefined) {
                    if (startTime === null) {
                        res.status(400).send("Invalid start_time");
                        return;
                    }
                    data.start_time = startTime;
                }
                const endTime = mapOptionalDate(req.body.end_time ?? req.body.endTime, "end_time", true);
                if (endTime !== undefined) {
                    data.end_time = endTime;
                }
            } catch (error) {
                if (error instanceof Error && error.message.startsWith("Invalid")) {
                    res.status(400).send(error.message);
                    return;
                }
                throw error;
            }

            if (req.body.status !== undefined) {
                const status = req.body.status as ShiftStatus;
                if (!VALID_SHIFT_STATUSES.includes(status)) {
                    res.status(400).send("Invalid status");
                    return;
                }
                data.status = status;
            }

            const shift = await this.service.update(id, data);
            if (!shift) {
                res.status(404).send("Shift not found");
                return;
            }
            res.json(shift.toJSON());
        } catch (err) {
            console.error(err);
            if (err instanceof Error && err.message.startsWith("Invalid")) {
                res.status(400).send(err.message);
            } else {
                res.status(500).send("Error updating shift");
            }
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
