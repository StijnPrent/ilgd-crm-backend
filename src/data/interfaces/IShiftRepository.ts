/**
 * IShiftRepository module.
 */
import {ShiftModel} from "../../business/models/ShiftModel";
import {ShiftStatus} from "../../rename/types";

/**
 * IShiftRepository interface.
 */
export interface IShiftRepository {
    findAll(filters?: {
        from?: Date;
        to?: Date;
        chatterId?: number;
    }): Promise<ShiftModel[]>;
    findById(id: number): Promise<ShiftModel | null>;
    create(data: {
        chatterId: number;
        modelIds: number[];
        date: Date | string;
        start_time: Date | string;
        end_time?: Date | string | null;
        status: ShiftStatus;
    }): Promise<ShiftModel>;
    update(id: number, data: {
        chatterId?: number;
        modelIds?: number[];
        date?: Date | string;
        start_time?: Date | string;
        end_time?: Date | string | null;
        status?: ShiftStatus;
    }): Promise<ShiftModel | null>;
    delete(id: number): Promise<void>;
    findShiftForChatterAt(chatterId: number, datetime: Date): Promise<ShiftModel | null>;
    findShiftForModelAt(modelId: number, datetime: Date): Promise<ShiftModel | null>;
    getActiveTimeEntry(chatterId: number): Promise<ShiftModel | null>;
}
