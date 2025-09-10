/**
 * ModelController module.
 */
import {Request, Response} from "express";
import {container} from "tsyringe";
import {ModelService} from "../business/services/ModelService";

/**
 * Controller for model-related operations.
 */
/**
 * ModelController class.
 */
export class ModelController {
    private get service(): ModelService {
        return container.resolve(ModelService);
    }

    /**
     * Retrieves all models.
     * @param _req Express request object.
     * @param res Express response object.
     */
    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const models = await this.service.getAll();
            res.json(models.map(m => m.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching models");
        }
    }

    /**
     * Retrieves a model by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const model = await this.service.getById(id);
            if (!model) {
                res.status(404).send("Model not found");
                return;
            }
            res.json(model.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching model");
        }
    }

    /**
     * Creates a new model.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async create(req: Request, res: Response): Promise<void> {
        try {
            const model = await this.service.create(req.body);
            res.status(201).json(model.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating model");
        }
    }

    /**
     * Updates an existing model.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const model = await this.service.update(id, req.body);
            if (!model) {
                res.status(404).send("Model not found");
                return;
            }
            res.json(model.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating model");
        }
    }

    /**
     * Deletes a model by ID.
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
            res.status(500).send("Error deleting model");
        }
    }
}
