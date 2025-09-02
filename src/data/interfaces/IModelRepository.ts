import {ModelModel} from "../../business/models/ModelModel";

export interface IModelRepository {
    findAll(): Promise<ModelModel[]>;
    findByUsername(username: string): Promise<ModelModel | null>;
}
