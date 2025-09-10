/**
 * ModelService module.
 */
import {inject, injectable} from "tsyringe";
import {IModelRepository} from "../../data/interfaces/IModelRepository";
import {ModelModel} from "../models/ModelModel";

/**
 * Service providing CRUD operations for models.
 */
@injectable()
/**
 * ModelService class.
 */
export class ModelService {
    constructor(
        @inject("IModelRepository") private modelRepo: IModelRepository
    ) {}

    /**
     * Returns all models.
     */
    public async getAll(): Promise<ModelModel[]> {
        return this.modelRepo.findAll();
    }

    /**
     * Finds a model by ID.
     * @param id Model identifier.
     */
    public async getById(id: number): Promise<ModelModel | null> {
        return this.modelRepo.findById(id);
    }

    /**
     * Creates a new model.
     * @param data Model data.
     */
    public async create(data: { displayName: string; username: string; commissionRate: number; }): Promise<ModelModel> {
        return this.modelRepo.create(data);
    }

    /**
     * Updates an existing model.
     * @param id Model identifier.
     * @param data Partial model data to update.
     */
    public async update(id: number, data: { displayName?: string; username?: string; commissionRate?: number; }): Promise<ModelModel | null> {
        return this.modelRepo.update(id, data);
    }

    /**
     * Deletes a model by ID.
     * @param id Model identifier.
     */
    public async delete(id: number): Promise<void> {
        await this.modelRepo.delete(id);
    }
}
