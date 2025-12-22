/**
 * ModelService module.
 */
import {inject, injectable} from "tsyringe";
import {IModelRepository} from "../../data/interfaces/IModelRepository";
import {ModelModel} from "../models/ModelModel";
import {ModelEarningsModel} from "../models/ModelEarningsModel";
import { IF2FCookieSettingRepository } from "../../data/interfaces/IF2FCookieSettingRepository";

/**
 * Service providing CRUD operations for models.
 */
@injectable()
/**
 * ModelService class.
 */
export class ModelService {
    constructor(
        @inject("IModelRepository") private modelRepo: IModelRepository,
        @inject("IF2FCookieSettingRepository") private cookieRepo: IF2FCookieSettingRepository,
    ) {}

    /**
     * Returns all models.
     */
    public async getAll(companyId: number): Promise<ModelModel[]> {
        const models = await this.modelRepo.findAll();
        return this.attachSupports(models, companyId);
    }

    /**
     * Finds a model by ID.
     * @param id Model identifier.
     */
    public async getById(id: number, companyId: number): Promise<ModelModel | null> {
        const model = await this.modelRepo.findById(id);
        if (!model) return null;
        const [withSupport] = await this.attachSupports([model], companyId);
        return withSupport;
    }

    /**
     * Creates a new model.
     * @param data Model data.
     */
    public async create(data: { displayName: string; username: string; commissionRate: number; companyId?: number; }): Promise<ModelModel> {
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

    /**
     * Returns all models with their total earnings before commissions.
     */
    public async getEarnings(params: {from?: Date; to?: Date;} = {}): Promise<ModelEarningsModel[]> {
        return this.modelRepo.findAllWithEarnings(params);
    }

    private async attachSupports(models: ModelModel[], companyId: number): Promise<ModelModel[]> {
        const cookies = await this.cookieRepo.getF2FCookies({ companyId }).catch(() => null);
        const entries = cookies?.entries ?? [];
        const modelIdSet = new Set<number>();
        const usernameSet = new Set<string>();
        for (const entry of entries) {
            if (entry.type !== "model") continue;
            const mid = typeof entry.modelId === "number" ? entry.modelId : Number(entry.modelId);
            if (Number.isFinite(mid)) modelIdSet.add(mid);
            if (entry.modelUsername) usernameSet.add(entry.modelUsername.toLowerCase());
        }
        return models.map(m => {
            const supports = modelIdSet.has(m.id) || usernameSet.has(m.username.toLowerCase());
            return m.withSupportsBuyerRelationship(supports);
        });
    }
}
