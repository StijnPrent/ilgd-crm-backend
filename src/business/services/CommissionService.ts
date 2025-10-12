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

        console.log(`CommissionService.ensureCommissionForShift: ensuring commission for shift ${shift.id}`);
        const existing = await this.commissionRepo.findByShiftId(Number(shift.id));
        if (existing) {
            console.log(`CommissionService.ensureCommissionForShift: existing commission ${existing.id} found for shift ${shift.id}`);
            return;
        }

        const calculation = await this.calculateCommissionForShift(shift);
        if (!calculation) {
            return;
        }

        await this.backfillShiftEarnings(shift, calculation.earningsRecords);

        if (!calculation.hasEarnings) {
            console.log(`CommissionService.ensureCommissionForShift: no earnings found for shift ${shift.id}, skipping`);
            return;
        }

        console.log(
            `CommissionService.ensureCommissionForShift: creating commission for shift ${shift.id} with earnings ${calculation.earnings} and commission ${calculation.commission}`,
        );
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
        console.log(`CommissionService.recalculateCommissionForShift: recalculating for shift ${shift.id}`);
        const existing = await this.commissionRepo.findByShiftId(shift.id);
        if (!existing) {
            console.log(`CommissionService.recalculateCommissionForShift: no commission found for shift ${shift.id}, ensuring new commission`);
            await this.ensureCommissionForShift(shift);
            return;
        }

        const calculation = await this.calculateCommissionForShift(shift);
        if (!calculation) {
            console.log(`CommissionService.recalculateCommissionForShift: unable to calculate commission for shift ${shift.id}`);
            return;
        }

        await this.backfillShiftEarnings(shift, calculation.earningsRecords);

        console.log(
            `CommissionService.recalculateCommissionForShift: updating commission ${existing.id} for shift ${shift.id} with earnings ${calculation.earnings} and commission ${calculation.commission}`,
        );
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

        const updatedEarnings = this.roundCurrency(Math.max(0, commission.earnings + earningsDelta));
        const commissionRate = this.normalizeRate(commission.commissionRate);
        const chatter = await this.chatterRepo.findById(commission.chatterId);
        const platformFeeRate = this.normalizeRate(chatter?.platformFee);
        const earningsAfterPlatformFee = this.roundCurrency(
            updatedEarnings * (1 - platformFeeRate),
        );
        const updatedCommissionAmount = this.roundCurrency(earningsAfterPlatformFee * commissionRate);
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
            console.log(`CommissionService.calculateCommissionForShift: shift ${shift.id} has no chatter`);
            return null;
        }

        const chatter = await this.chatterRepo.findById(chatterId);
        if (chatter?.show) {
            console.log(`CommissionService.calculateCommissionForShift: chatter ${chatterId} is a show, skipping commission`);
            return null;
        }

        const earnings = await this.earningRepo.findAll({ shiftId: shift.id });
        const earningsTotal = this.roundCurrency(
            earnings.reduce((sum, earning) => sum + earning.amount, 0),
        );
        console.log(
            `CommissionService.calculateCommissionForShift: shift ${shift.id} earnings total ${earningsTotal} from ${earnings.length} records`,
        );
        const platformFeeRate = this.normalizeRate(chatter?.platformFee);
        const earningsAfterPlatformFee = this.roundCurrency(
            earningsTotal * (1 - platformFeeRate),
        );
        const commissionRate = Number(chatter?.commissionRate ?? 0);
        const commissionAmount = this.roundCurrency(
            earningsAfterPlatformFee * this.normalizeRate(commissionRate),
        );

        console.log(
            `CommissionService.calculateCommissionForShift: computed commission ${commissionAmount} at rate ${commissionRate}% after platform fee ${platformFeeRate * 100}% for shift ${shift.id}`,
        );
        return {
            chatterId,
            commissionDate: this.resolveCommissionDate(shift.date),
            earnings: earningsTotal,
            commissionRate,
            commission: commissionAmount,
            hasEarnings: earnings.length > 0,
            earningsRecords: earnings,
        };
    }

    private async backfillShiftEarnings(shift: ShiftModel, earnings: EmployeeEarningModel[]): Promise<void> {
        const chatterId = shift.chatterId;
        if (!chatterId || !earnings.length) {
            return;
        }

        const eligible = earnings.filter(earning => this.isBackfillableEarningType(earning.type));
        if (!eligible.length) {
            console.log(`CommissionService.backfillShiftEarnings: no pay-per-message/tip earnings to backfill for shift ${shift.id}`);
            return;
        }

        const toUpdate = eligible.filter(earning => earning.chatterId == null || earning.shiftId == null);
        if (!toUpdate.length) {
            console.log(
                `CommissionService.backfillShiftEarnings: all ${eligible.length} pay-per-message/tip earnings already linked for shift ${shift.id}`,
            );
            return;
        }

        console.log(
            `CommissionService.backfillShiftEarnings: linking ${toUpdate.length} of ${eligible.length} pay-per-message/tip earnings to shift ${shift.id}`,
        );

        for (const earning of toUpdate) {
            const newChatterId = earning.chatterId ?? chatterId;
            const newShiftId = earning.shiftId ?? shift.id;
            console.log(
                `CommissionService.backfillShiftEarnings: updating earning ${earning.id} -> chatter ${newChatterId}, shift ${newShiftId}`,
            );
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
