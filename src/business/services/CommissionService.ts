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
import { EmployeeEarningModel } from "../models/EmployeeEarningModel";

export const COMMISSION_ELIGIBLE_EARNING_TYPES = ["tip", "paypermessage"];

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

            const didCreate = await this.ensureCommissionForShift(shift);
            if (didCreate) {
                created += 1;
            } else {
                skipped += 1;
            }
        }

        return { totalShifts, created, skipped };
    }

    /**
     * Ensures a commission exists for the provided shift, creating it if necessary.
     * @param shift Completed shift information.
     */
    public async ensureCommissionForShift(shift: ShiftModel): Promise<boolean> {
        const chatterId = shift.chatterId;
        if (!chatterId) return false;

        const existing = await this.commissionRepo.findByShiftId(Number(shift.id));
        if (existing) {
            return false;
        }

        const calculation = await this.calculateCommissionForShift(shift);
        if (!calculation) {
            return false;
        }

        await this.backfillShiftEarnings(shift, calculation.earningsRecords);

        if (!calculation.hasEarnings) {
            return false;
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
        return true;
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

        await this.backfillShiftEarnings(shift, calculation.earningsRecords);

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

    public async applyEarningDeltaToClosestCommission(
        chatterId: number,
        date: Date,
        earningsDelta: number,
        shiftId?: number | null,
    ): Promise<void> {
        if (!earningsDelta) {
            return;
        }

        let commission = await this.commissionRepo.findClosestByChatterIdAndDate(chatterId, date);
        if (!commission) {
            const shift = await this.resolveCompletedShiftForCommission(chatterId, date, shiftId);
            if (!shift) {
                return;
            }

            await this.ensureCommissionForShift(shift);
            commission = await this.commissionRepo.findClosestByChatterIdAndDate(chatterId, date);
            if (!commission) {
                return;
            }
        }

        const commissionRate = this.normalizeRate(commission.commissionRate);
        const chatter = await this.chatterRepo.findById(commission.chatterId);
        const platformFeeRate = this.normalizeRate(chatter?.platformFee);
        const earningsDeltaAfterPlatformFee = this.roundCurrency(
            earningsDelta * (1 - platformFeeRate),
        );
        const updatedEarnings = this.roundCurrency(
            Math.max(0, commission.earnings + earningsDeltaAfterPlatformFee),
        );
        const updatedCommissionAmount = this.roundCurrency(updatedEarnings * commissionRate);
        const totalPayout = this.roundCurrency(updatedCommissionAmount + commission.bonus);

        await this.commissionRepo.update(commission.id, {
            earnings: updatedEarnings,
            commission: updatedCommissionAmount,
            totalPayout,
        });
    }

    private async resolveCompletedShiftForCommission(
        chatterId: number,
        date: Date,
        shiftId?: number | null,
    ): Promise<ShiftModel | null> {
        if (shiftId) {
            const shift = await this.shiftRepo.findById(shiftId);
            if (shift?.status === "completed") {
                return shift;
            }
        }

        const shift = await this.shiftRepo.findShiftForChatterAt(chatterId, date);
        if (shift?.status === "completed") {
            return shift;
        }

        return null;
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
        earningsRecords: EmployeeEarningModel[];
    } | null> {
        const chatterId = shift.chatterId;
        if (!chatterId) {
            return null;
        }

        const chatter = await this.chatterRepo.findById(chatterId);
        if (!chatter?.show) {
            return null;
        }

        // Primary: fetch by strict shift window (repository handles chatter/model matching)
        const earningsByWindow = await this.earningRepo.findAll({
            shiftId: shift.id,
            types: [...COMMISSION_ELIGIBLE_EARNING_TYPES],
        });
        let eligibleEarnings = earningsByWindow.filter(earning =>
            !!earning.type && COMMISSION_ELIGIBLE_EARNING_TYPES.includes(String(earning.type).toLowerCase()),
        );

        // Fallback: if nothing was found in the time window, aggregate over business day
        if (eligibleEarnings.length === 0) {
            const commissionDate = this.resolveCommissionDate(shift.date);
            const dayStart = new Date(Date.UTC(
                commissionDate.getUTCFullYear(),
                commissionDate.getUTCMonth(),
                commissionDate.getUTCDate(),
                0, 0, 0, 0,
            ));
            const dayEnd = new Date(Date.UTC(
                commissionDate.getUTCFullYear(),
                commissionDate.getUTCMonth(),
                commissionDate.getUTCDate(),
                23, 59, 59, 999,
            ));

            const buckets: EmployeeEarningModel[][] = [];
            // Chatter-wide earnings for the day
            buckets.push(await this.earningRepo.findAll({
                chatterId,
                from: dayStart,
                to: dayEnd,
                types: [...COMMISSION_ELIGIBLE_EARNING_TYPES],
            }));
            // Per-model earnings for the day
            if (Array.isArray(shift.modelIds) && shift.modelIds.length) {
                for (const mid of shift.modelIds) {
                    buckets.push(await this.earningRepo.findAll({
                        modelId: mid,
                        from: dayStart,
                        to: dayEnd,
                        types: [...COMMISSION_ELIGIBLE_EARNING_TYPES],
                    }));
                }
            }

            const merged: Map<string, EmployeeEarningModel> = new Map();
            for (const list of buckets) {
                for (const e of list) {
                    merged.set(e.id, e);
                }
            }
            eligibleEarnings = Array.from(merged.values()).filter(earning =>
                !!earning.type && COMMISSION_ELIGIBLE_EARNING_TYPES.includes(String(earning.type).toLowerCase()),
            );

            
        }
        const earningsTotal = this.roundCurrency(
            eligibleEarnings.reduce((sum, earning) => sum + earning.amount, 0),
        );
        const platformFeeRate = this.normalizeRate(chatter?.platformFee);
        const earningsAfterPlatformFee = this.roundCurrency(
            earningsTotal * (1 - platformFeeRate),
        );
        const commissionRate = Number(chatter?.commissionRate ?? 0);
        const commissionAmount = this.roundCurrency(
            earningsAfterPlatformFee * this.normalizeRate(commissionRate),
        );

        return {
            chatterId,
            commissionDate: this.resolveCommissionDate(shift.date),
            earnings: earningsAfterPlatformFee,
            commissionRate,
            commission: commissionAmount,
            hasEarnings: eligibleEarnings.length > 0,
            earningsRecords: eligibleEarnings,
        };
    }

    private async backfillShiftEarnings(shift: ShiftModel, earnings: EmployeeEarningModel[]): Promise<void> {
        const chatterId = shift.chatterId;
        if (!chatterId || !earnings.length) {
            return;
        }

        const eligible = earnings.filter(earning => this.isBackfillableEarningType(earning.type));
        if (!eligible.length) {
            return;
        }

        const toUpdate = eligible.filter(earning => earning.chatterId == null || earning.shiftId == null);
        if (!toUpdate.length) {
            return;
        }

        

        for (const earning of toUpdate) {
            const newChatterId = earning.chatterId ?? chatterId;
            const newShiftId = earning.shiftId ?? shift.id;
            await this.earningRepo.update(earning.id, {
                chatterId: newChatterId,
                shiftId: newShiftId,
            });
        }
    }

    private isBackfillableEarningType(type?: string | null): boolean {
        if (!type) {
            return false;
        }

        const normalized = type.toLowerCase();
        return normalized === "paypermessage" || normalized === "tip";
    }
}
