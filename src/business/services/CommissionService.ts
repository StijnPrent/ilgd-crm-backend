/**
 * CommissionService module.
 */
import { inject, injectable } from "tsyringe";
import { ICommissionRepository } from "../../data/interfaces/ICommissionRepository";
import { CommissionModel } from "../models/CommissionModel";
import { CommissionStatus } from "../../rename/types";

/**
 * Service managing commissions for chatters.
 */
@injectable()
/**
 * CommissionService class.
 */
export class CommissionService {
    constructor(
        @inject("ICommissionRepository") private commissionRepo: ICommissionRepository
    ) {}

    /**
     * Retrieves all commission records.
     */
    public async getAll(): Promise<CommissionModel[]> {
        return this.commissionRepo.findAll();
    }

    /**
     * Retrieves a commission by its ID.
     * @param id Commission identifier.
     */
    public async getById(id: number): Promise<CommissionModel | null> {
        return this.commissionRepo.findById(id);
    }

    /**
     * Creates a new commission record.
     * @param data Commission data.
     */
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

    /**
     * Updates an existing commission record.
     * @param id Commission identifier.
     * @param data Partial commission data.
     */
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

    /**
     * Deletes a commission by ID.
     * @param id Commission identifier.
     */
    public async delete(id: number): Promise<void> {
        await this.commissionRepo.delete(id);
    }
}
