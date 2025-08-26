import {Request, Response} from "express";
import {container} from "tsyringe";
import {ShiftService} from "../business/services/ShiftService";

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
            const shift = await this.service.create(req.body);
            res.status(201).json(shift.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating shift");
        }
    }

    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const shift = await this.service.update(id, req.body);
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
}
