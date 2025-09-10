/**
 * IModelRepository module.
 */
import {ModelModel} from "../../business/models/ModelModel";

/**
 * IModelRepository interface.
 */
export interface IModelRepository {
    findAll(): Promise<ModelModel[]>;
    findById(id: number): Promise<ModelModel | null>;
    create(data: { displayName: string; username: string; commissionRate: number; }): Promise<ModelModel>;
    update(id: number, data: { displayName?: string; username?: string; commissionRate?: number; }): Promise<ModelModel | null>;
    delete(id: number): Promise<void>;
}
