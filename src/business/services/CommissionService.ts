/**
 * CommissionService module.
 */
import { inject, injectable } from "tsyringe";
import { ICommissionRepository } from "../../data/interfaces/ICommissionRepository";
import { CommissionModel } from "../models/CommissionModel";
import { CommissionStatus } from "../../rename/types";
import { IEmployeeEarningRepository } from "../../data/interfaces/IEmployeeEarningRepository";
import { IChatterRepository } from "../../data/interfaces/IChatterRepository";
import { ShiftModel } from "../models/ShiftModel";

type CommissionQueryParams = {
    limit?: number;
    offset?: number;
    chatterId?: number;
    date?: Date;
    from?: Date;
    to?: Date;
};

type CommissionCreateInput = {
    chatterId: number;
    shiftId?: number | null;
    commissionDate: Date;
    earnings: number;
    commissionRate: number;
    commission: number;
    bonus?: number;
    totalPayout?: number;
    status: CommissionStatus;
};

type CommissionUpdateInput = {
    chatterId?: number;
    shiftId?: number | null;
    commissionDate?: Date;
    earnings?: number;
    commissionRate?: number;
    commission?: number;
    bonus?: number;
    totalPayout?: number;
    status?: CommissionStatus;
};

/**
 * Service managing commissions for chatters.
 */
@injectable()
export class CommissionService {
    constructor(
        @inject("ICommissionRepository") private commissionRepo: ICommissionRepository,
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        @inject("IChatterRepository") private chatterRepo: IChatterRepository,
    ) {}

    /**
     * Retrieves commission records using optional filters and pagination.
     */
    public async getAll(params: CommissionQueryParams = {}): Promise<CommissionModel[]> {
        return this.commissionRepo.findAll(params);
    }

    /**
     * Retrieves the total count for commission records using the provided filters.
     */
    public async totalCount(params: CommissionQueryParams = {}): Promise<number> {
        return this.commissionRepo.totalCount(params);
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
    public async create(data: CommissionCreateInput): Promise<CommissionModel> {
        const bonus = data.bonus ?? 0;
        const totalPayout = data.totalPayout ?? data.commission + bonus;
        return this.commissionRepo.create({ ...data, bonus, totalPayout });
    }

    /**
     * Updates an existing commission record.
     * @param id Commission identifier.
     * @param data Partial commission data.
     */
    public async update(id: number, data: CommissionUpdateInput): Promise<CommissionModel | null> {
        return this.commissionRepo.update(id, data);
    }

    /**
     * Deletes a commission by ID.
     * @param id Commission identifier.
     */
    public async delete(id: number): Promise<void> {
        await this.commissionRepo.delete(id);
    }

    /**
     * Ensures a commission exists for the provided shift, creating it if necessary.
     * @param shift Completed shift information.
     */
    public async ensureCommissionForShift(shift: ShiftModel): Promise<void> {
        const chatterId = shift.chatterId;
        if (!chatterId) return;

        const existing = await this.commissionRepo.findByShiftId(shift.id);
        if (existing) {
            return;
        }

        const [earnings, chatter] = await Promise.all([
            this.earningRepo.findAll({ shiftId: shift.id }),
            this.chatterRepo.findById(chatterId),
        ]);

        const earningsTotal = earnings.reduce((sum, earning) => sum + earning.amount, 0);
        const commissionRate = chatter?.commissionRate ?? 0;
        const commissionAmount = this.roundCurrency(earningsTotal * commissionRate);

        await this.commissionRepo.create({
            chatterId,
            shiftId: shift.id,
            commissionDate: this.resolveCommissionDate(shift.date),
            earnings: this.roundCurrency(earningsTotal),
            commissionRate,
            commission: commissionAmount,
            bonus: 0,
            totalPayout: commissionAmount,
            status: "pending",
        });
    }

    private roundCurrency(value: number): number {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    private resolveCommissionDate(input: any): Date {
        if (input instanceof Date) {
            return input;
        }
        if (typeof input === "string") {
            const parsed = new Date(input);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        if (input && typeof input === "object" && typeof input.toString === "function") {
            const parsed = new Date(input.toString());
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return new Date();
    }
}
