/**
 * CommissionService module.
 */
import { inject, injectable } from "tsyringe";
import { ICommissionRepository } from "../../data/interfaces/ICommissionRepository";
import { CommissionStatus } from "../../rename/types";
import { IEmployeeEarningRepository } from "../../data/interfaces/IEmployeeEarningRepository";
import { IChatterRepository } from "../../data/interfaces/IChatterRepository";
import { IShiftRepository } from "../../data/interfaces/IShiftRepository";
import { CommissionModel } from "../models/CommissionModel";
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
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
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
     * Iterates through all shifts and ensures commissions exist for them.
     * Returns a summary including how many commissions were created.
     */
    public async updateAllFromShifts(): Promise<{
        totalShifts: number;
        created: number;
        skipped: number;
    }> {
        const shifts = await this.shiftRepo.findAll();
        const totalShifts = shifts.length;
        let created = 0;
        let skipped = 0;

        for (const shift of shifts) {
            if (!shift.chatterId || shift.status !== "completed") {
                skipped += 1;
                continue;
            }

            const existing = await this.commissionRepo.findByShiftId(shift.id);
            if (existing) {
                skipped += 1;
                continue;
            }

            await this.ensureCommissionForShift(shift);
            created += 1;
        }

        return { totalShifts, created, skipped };
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

        const calculation = await this.calculateCommissionForShift(shift);
        if (!calculation || !calculation.hasEarnings) {
            return;
        }

        await this.commissionRepo.create({
            chatterId: calculation.chatterId,
            shiftId: shift.id,
            commissionDate: calculation.commissionDate,
            earnings: calculation.earnings,
            commissionRate: calculation.commissionRate,
            commission: calculation.commission,
            bonus: 0,
            totalPayout: calculation.commission,
            status: "pending",
        });
    }

    /**
     * Forces a recalculation of the commission tied to the provided shift.
     * If a commission does not yet exist, it will be created (when applicable).
     */
    public async recalculateCommissionForShift(shift: ShiftModel): Promise<void> {
        const existing = await this.commissionRepo.findByShiftId(shift.id);
        if (!existing) {
            await this.ensureCommissionForShift(shift);
            return;
        }

        const calculation = await this.calculateCommissionForShift(shift);
        if (!calculation) {
            return;
        }

        const totalPayout = this.roundCurrency(calculation.commission + existing.bonus);

        await this.commissionRepo.update(existing.id, {
            chatterId: calculation.chatterId,
            shiftId: shift.id,
            commissionDate: calculation.commissionDate,
            earnings: calculation.earnings,
            commissionRate: calculation.commissionRate,
            commission: calculation.commission,
            totalPayout,
        });
    }

    private normalizeRate(rate?: number | null): number {
        if (!rate || Number.isNaN(rate)) return 0;
        const r = Number(rate);
        return r > 1 ? r / 100 : r;   // 10 -> 0.10, 0.1 -> 0.1
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

    private async calculateCommissionForShift(shift: ShiftModel): Promise<{
        chatterId: number;
        commissionDate: Date;
        earnings: number;
        commissionRate: number;
        commission: number;
        hasEarnings: boolean;
    } | null> {
        const chatterId = shift.chatterId;
        if (!chatterId) {
            return null;
        }

        const chatter = await this.chatterRepo.findById(chatterId);
        if (!chatter?.show) {
            return null;
        }

        const earnings = await this.earningRepo.findAll({ shiftId: shift.id });
        const earningsTotal = this.roundCurrency(
            earnings.reduce((sum, earning) => sum + earning.amount, 0),
        );
        const commissionRate = Number(chatter.commissionRate ?? 0);
        const commissionAmount = this.roundCurrency(earningsTotal * (commissionRate / 100));

        return {
            chatterId,
            commissionDate: this.resolveCommissionDate(shift.date),
            earnings: earningsTotal,
            commissionRate,
            commission: commissionAmount,
            hasEarnings: earnings.length > 0,
        };
    }
}
