/**
 * ICommissionRepository module.
 */
import { CommissionModel } from "../../business/models/CommissionModel";
import { CommissionStatus } from "../../rename/types";

/**
 * ICommissionRepository interface.
 */
export interface ICommissionRepository {
    findAll(params?: {
        limit?: number;
        offset?: number;
        chatterId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
    }): Promise<CommissionModel[]>;
    findById(id: number): Promise<CommissionModel | null>;
    findByShiftId(shiftId: number): Promise<CommissionModel | null>;
    create(data: {
        chatterId: number;
        shiftId?: number | null;
        commissionDate: Date;
        earnings: number;
        commissionRate: number;
        commission: number;
        bonus?: number;
        totalPayout?: number;
        status: CommissionStatus;
    }): Promise<CommissionModel>;
    update(id: number, data: {
        chatterId?: number;
        shiftId?: number | null;
        commissionDate?: Date;
        earnings?: number;
        commissionRate?: number;
        commission?: number;
        bonus?: number;
        totalPayout?: number;
        status?: CommissionStatus;
    }): Promise<CommissionModel | null>;
    totalCount(params?: {
        chatterId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
    }): Promise<number>;
    delete(id: number): Promise<void>;
}
