/**
 * IShiftRepository module.
 */
import {ShiftModel} from "../../business/models/ShiftModel";
import {ShiftStatus} from "../../rename/types";

/**
 * IShiftRepository interface.
 */
export interface IShiftRepository {
    findAll(): Promise<ShiftModel[]>;
    findById(id: number): Promise<ShiftModel | null>;
    create(data: {
        chatterId: number;
        modelIds: number[];
        date: Date;
        start_time: Date;
        end_time?: Date | null;
        status: ShiftStatus;
        isWeekly?: boolean;
        recurrenceParentId?: number | null;
    }): Promise<ShiftModel>;
    update(id: number, data: {
        chatterId?: number;
        modelIds?: number[];
        date?: Date;
        start_time?: Date;
        end_time?: Date | null;
        status?: ShiftStatus;
        isWeekly?: boolean;
        recurrenceParentId?: number | null;
    }): Promise<ShiftModel | null>;
    delete(id: number): Promise<void>;
    findShiftForChatterAt(chatterId: number, datetime: Date): Promise<ShiftModel | null>;
    findShiftForModelAt(modelId: number, datetime: Date): Promise<ShiftModel | null>;
    getActiveTimeEntry(chatterId: number): Promise<ShiftModel | null>;
}
