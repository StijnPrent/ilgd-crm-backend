import {Request, Response} from "express";
import {container} from "tsyringe";
import {ShiftService} from "../business/services/ShiftService";
import {ShiftModel} from "../business/models/ShiftModel";

export class ShiftController {
    private get service(): ShiftService {
        return container.resolve(ShiftService);
    }

    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const shifts = await this.service.getAll();
            res.json(shifts.map(s => s.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching shifts");
        }
    }

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

    public async create(req: Request, res: Response): Promise<void> {
        try {
            const data = {
                ...req.body,
                modelIds: Array.isArray(req.body.modelIds) ? req.body.modelIds.map((n: any) => Number(n)) : [],
            };
            const shift = await this.service.create(data);
            res.status(201).json(shift.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating shift");
        }
    }

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

    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const data = {
                ...req.body,
                ...(Array.isArray(req.body.modelIds)
                    ? {modelIds: req.body.modelIds.map((n: any) => Number(n))}
                    : {}),
            };
            const shift = await this.service.update(id, data);
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
