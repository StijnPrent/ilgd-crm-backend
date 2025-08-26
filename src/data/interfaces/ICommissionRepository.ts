import { CommissionModel } from "../../business/models/CommissionModel";
import { CommissionStatus } from "../../rename/types";

export interface ICommissionRepository {
    findAll(): Promise<CommissionModel[]>;
    findById(id: number): Promise<CommissionModel | null>;
    create(data: {
        chatterId: number;
        periodStart: Date;
        periodEnd: Date;
        earnings: number;
        commissionRate: number;
        commission: number;
        status: CommissionStatus;
    }): Promise<CommissionModel>;
    update(id: number, data: {
        chatterId?: number;
        periodStart?: Date;
        periodEnd?: Date;
        earnings?: number;
        commissionRate?: number;
        commission?: number;
        status?: CommissionStatus;
    }): Promise<CommissionModel | null>;
    delete(id: number): Promise<void>;
}
