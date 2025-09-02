import {inject, injectable} from "tsyringe";
import {IModelRepository} from "../../data/interfaces/IModelRepository";
import {ModelModel} from "../models/ModelModel";

@injectable()
export class ModelService {
    constructor(
        @inject("IModelRepository") private modelRepo: IModelRepository
    ) {}

    public async getAll(): Promise<ModelModel[]> {
        return this.modelRepo.findAll();
    }

    public async getById(id: number): Promise<ModelModel | null> {
        return this.modelRepo.findById(id);
    }

    public async create(data: { displayName: string; username: string; commissionRate: number; }): Promise<ModelModel> {
        return this.modelRepo.create(data);
    }

    public async update(id: number, data: { displayName?: string; username?: string; commissionRate?: number; }): Promise<ModelModel | null> {
        return this.modelRepo.update(id, data);
    }

    public async delete(id: number): Promise<void> {
        await this.modelRepo.delete(id);
    }
}
