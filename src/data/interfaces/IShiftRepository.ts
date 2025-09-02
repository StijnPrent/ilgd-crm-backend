import {ShiftModel} from "../../business/models/ShiftModel";
import {ShiftStatus} from "../../rename/types";

export interface IShiftRepository {
    findAll(): Promise<ShiftModel[]>;
    findInRange(from: Date, to: Date): Promise<ShiftModel[]>;
    findById(id: number): Promise<ShiftModel | null>;
    create(data: {
        chatterId: number;
        date: Date;
        start_time: Date;
        end_time?: Date | null;
        status: ShiftStatus;
    }): Promise<ShiftModel>;
    update(id: number, data: {
        chatterId?: number;
        date?: Date;
        start_time?: Date;
        end_time?: Date | null;
        status?: ShiftStatus;
    }): Promise<ShiftModel | null>;
    delete(id: number): Promise<void>;
    getActiveTimeEntry(chatterId: number): Promise<ShiftModel | null>;
}
