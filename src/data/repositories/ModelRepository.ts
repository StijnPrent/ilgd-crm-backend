import {BaseRepository} from "./BaseRepository";
import {IModelRepository} from "../interfaces/IModelRepository";
import {ModelModel} from "../../business/models/ModelModel";
import {RowDataPacket} from "mysql2";

export class ModelRepository extends BaseRepository implements IModelRepository {
    public async findAll(): Promise<ModelModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, username FROM models",
            []
        );
        return rows.map(ModelModel.fromRow);
    }

    public async findByUsername(username: string): Promise<ModelModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, username FROM models WHERE username = ?",
            [username]
        );
        return rows.length ? ModelModel.fromRow(rows[0]) : null;
    }
}
