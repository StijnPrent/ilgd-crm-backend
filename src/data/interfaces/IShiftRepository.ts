import {ShiftModel} from "../../business/models/ShiftModel";
import {ShiftStatus} from "../../rename/types";

export interface IShiftRepository {
    findAll(): Promise<ShiftModel[]>;
    findById(id: number): Promise<ShiftModel | null>;
    create(data: {
        chatterId: number;
        date: Date;
        start_time: Date;
        end_time: Date;
        status: ShiftStatus;
    }): Promise<ShiftModel>;
    update(id: number, data: {
        chatterId?: number;
        date?: Date;
        start_time?: Date;
        end_time?: Date;
        status?: ShiftStatus;
    }): Promise<ShiftModel | null>;
    delete(id: number): Promise<void>;
}
