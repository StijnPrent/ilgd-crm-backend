import { inject, injectable } from "tsyringe";
import { ICommissionRepository } from "../../data/interfaces/ICommissionRepository";
import { CommissionModel } from "../models/CommissionModel";
import { CommissionStatus } from "../../rename/types";

@injectable()
export class CommissionService {
    constructor(
        @inject("ICommissionRepository") private commissionRepo: ICommissionRepository
    ) {}

    public async getAll(): Promise<CommissionModel[]> {
        return this.commissionRepo.findAll();
    }

    public async getById(id: number): Promise<CommissionModel | null> {
        return this.commissionRepo.findById(id);
    }

    public async create(data: {
        chatterId: number;
        periodStart: Date;
        periodEnd: Date;
        earnings: number;
        commissionRate: number;
        commission: number;
        status: CommissionStatus;
    }): Promise<CommissionModel> {
        return this.commissionRepo.create(data);
    }

    public async update(id: number, data: {
        chatterId?: number;
        periodStart?: Date;
        periodEnd?: Date;
        earnings?: number;
        commissionRate?: number;
        commission?: number;
        status?: CommissionStatus;
    }): Promise<CommissionModel | null> {
        return this.commissionRepo.update(id, data);
    }

    public async delete(id: number): Promise<void> {
        await this.commissionRepo.delete(id);
    }
}
