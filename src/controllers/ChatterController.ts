import {Request, Response} from "express";
import {container} from "tsyringe";
import {ChatterService} from "../business/services/ChatterService";

/**
 * Controller responsible for managing chatters.
 */
export class ChatterController {
    private get service(): ChatterService {
        return container.resolve(ChatterService);
    }

    /**
     * Retrieves all chatters.
     * @param _req Express request object.
     * @param res Express response object.
     */
    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const chatters = await this.service.getAll();
            res.json(chatters.map(c => c.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching chatters");
        }
    }

    /**
     * Retrieves a chatter by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
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

    /**
     * Creates a new chatter.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async create(req: Request, res: Response): Promise<void> {
        try {
            const chatter = await this.service.create(req.body);
            res.status(201).json(chatter.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating chatter");
        }
    }

    /**
     * Updates an existing chatter.
     * @param req Express request object.
     * @param res Express response object.
     */
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

    /**
     * Deletes a chatter by ID.
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
            res.status(500).send("Error deleting chatter");
        }
    }
}
