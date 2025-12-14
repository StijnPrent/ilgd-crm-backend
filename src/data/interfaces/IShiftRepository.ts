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
        companyId?: number;
        from?: Date;
        to?: Date;
        chatterId?: number;
    }): Promise<ShiftModel[]>;
    findById(id: number): Promise<ShiftModel | null>;
    create(data: {
        companyId: number;
        chatterId: number;
        modelIds: number[];
        date: Date | string;
        start_time: Date | string;
        end_time?: Date | string | null;
        status: ShiftStatus;
        recurringGroupId?: string | null;
    }): Promise<ShiftModel>;
    update(id: number, data: {
        companyId?: number;
        chatterId?: number;
        modelIds?: number[];
        date?: Date | string;
        start_time?: Date | string;
        end_time?: Date | string | null;
        status?: ShiftStatus;
        recurringGroupId?: string | null;
    }): Promise<ShiftModel | null>;
    delete(id: number): Promise<void>;
    findShiftForChatterAt(chatterId: number, datetime: Date): Promise<ShiftModel | null>;
    findClosestCompletedShiftForChatter(chatterId: number, datetime: Date): Promise<ShiftModel | null>;
    findShiftForModelAt(modelId: number, datetime: Date): Promise<ShiftModel | null>;
    getActiveTimeEntry(chatterId: number): Promise<ShiftModel | null>;
    deleteByRecurringGroupFromDate(
        recurringGroupId: string,
        fromDate: Date, // normalized UTC
        companyId: number
    ): Promise<number>;
}
