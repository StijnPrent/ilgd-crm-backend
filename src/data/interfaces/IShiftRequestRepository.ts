/**
 * IShiftRequestRepository module.
 */
import {ShiftRequestModel} from "../../business/models/ShiftRequestModel";
import {ShiftRequestStatus, ShiftRequestType} from "../../rename/types";

export interface ShiftRequestFilters {
    status?: ShiftRequestStatus;
    chatterId?: number;
    includeResolved?: boolean;
}

export interface CreateShiftRequestInput {
    shiftId: number;
    chatterId: number;
    type: ShiftRequestType;
    note?: string | null;
}

export interface UpdateShiftRequestInput {
    status?: ShiftRequestStatus;
    managerNote?: string | null;
    resolvedAt?: Date | null;
}

export interface IShiftRequestRepository {
    findAll(filters?: ShiftRequestFilters): Promise<ShiftRequestModel[]>;
    findById(id: number): Promise<ShiftRequestModel | null>;
    create(data: CreateShiftRequestInput): Promise<ShiftRequestModel>;
    update(id: number, data: UpdateShiftRequestInput): Promise<ShiftRequestModel | null>;
}
