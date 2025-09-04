import {Request, Response} from "express";
import {container} from "tsyringe";
import {EmployeeEarningService} from "../business/services/EmployeeEarningService";

export class EmployeeEarningController {
    private get service(): EmployeeEarningService {
        return container.resolve(EmployeeEarningService);
    }

    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const earnings = await this.service.getAll();
            res.json(earnings.map(e => e.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching earnings");
        }
    }

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

    public async create(req: Request, res: Response): Promise<void> {
        try {
            const earning = await this.service.create(req.body);
            res.status(201).json(earning.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating earning");
        }
    }

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
