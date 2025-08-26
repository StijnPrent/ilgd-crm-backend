import { Request, Response } from "express";
import { container } from "tsyringe";
import { CommissionService } from "../business/services/CommissionService";

export class CommissionController {
    private get service(): CommissionService {
        return container.resolve(CommissionService);
    }

    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const commissions = await this.service.getAll();
            res.json(commissions.map(c => c.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching commissions");
        }
    }

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

    public async create(req: Request, res: Response): Promise<void> {
        try {
            const commission = await this.service.create(req.body);
            res.status(201).json(commission.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating commission");
        }
    }

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
