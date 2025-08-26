import {Request, Response} from "express";
import {container} from "tsyringe";
import {ChatterService} from "../business/services/ChatterService";

export class ChatterController {
    private get service(): ChatterService {
        return container.resolve(ChatterService);
    }

    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const chatters = await this.service.getAll();
            res.json(chatters.map(c => c.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching chatters");
        }
    }

    public async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const chatter = await this.service.getById(id);
            if (!chatter) {
                res.status(404).send("Chatter not found");
                return;
            }
            res.json(chatter.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching chatter");
        }
    }

    public async create(req: Request, res: Response): Promise<void> {
        try {
            const chatter = await this.service.create(req.body);
            res.status(201).json(chatter.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating chatter");
        }
    }

    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const chatter = await this.service.update(id, req.body);
            if (!chatter) {
                res.status(404).send("Chatter not found");
                return;
            }
            res.json(chatter.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating chatter");
        }
    }

    public async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            await this.service.delete(id);
            res.sendStatus(204);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error deleting chatter");
        }
    }
}
