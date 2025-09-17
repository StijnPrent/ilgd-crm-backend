/**
 * ShiftService module.
 */
import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {ShiftModel} from "../models/ShiftModel";
import {ShiftStatus} from "../../rename/types";
import {CommissionService} from "./CommissionService";

/**
 * Service responsible for shift management.
 */
@injectable()
/**
 * ShiftService class.
 */
export class ShiftService {
    constructor(
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
        @inject("CommissionService") private commissionService: CommissionService,
    ) {}

    /**
     * Returns all shifts.
     */
    public async getAll(filters?: {from?: Date; to?: Date; chatterId?: number;}): Promise<ShiftModel[]> {
        const result = await this.shiftRepo.findAll(filters);
        return result;
    }

    /**
     * Finds a shift by its ID.
     * @param id Shift identifier.
     */
    public async getById(id: number): Promise<ShiftModel | null> {
        return this.shiftRepo.findById(id);
    }

    /**
     * Creates a new shift.
     * @param data Shift information.
     */
    public async create(
        data: { chatterId: number; modelIds: number[]; date: Date; start_time: Date; end_time?: Date | null; status: ShiftStatus; },
        options?: { repeatWeekly?: boolean; repeatWeeks?: number; }
    ): Promise<ShiftModel> {
        const created = await this.shiftRepo.create(data);
        const repeatWeekly = options?.repeatWeekly ?? false;
        const repeatWeeks = options?.repeatWeeks ?? 0;

        if (repeatWeekly && repeatWeeks > 0) {
            const baseDate = new Date(data.date);
            const baseStart = new Date(data.start_time);
            const baseEnd = data.end_time ? new Date(data.end_time) : null;

            for (let i = 1; i <= repeatWeeks; i++) {
                const nextDate = new Date(baseDate);
                nextDate.setDate(nextDate.getDate() + i * 7);

                const nextStart = new Date(baseStart);
                nextStart.setDate(nextStart.getDate() + i * 7);

                const nextEnd = baseEnd ? new Date(baseEnd) : null;
                if (nextEnd) {
                    nextEnd.setDate(nextEnd.getDate() + i * 7);
                }

                await this.shiftRepo.create({
                    ...data,
                    date: nextDate,
                    start_time: nextStart,
                    end_time: nextEnd,
                });
            }
        }

        return created;
    }

    /**
     * Updates an existing shift.
     * @param id Shift identifier.
     * @param data Partial shift data.
     */
    public async update(id: number, data: { chatterId?: number; modelIds?: number[]; date?: Date; start_time?: Date; end_time?: Date | null; status?: ShiftStatus; }): Promise<ShiftModel | null> {
        const updated = await this.shiftRepo.update(id, data);
        if (updated && updated.status === "completed") {
            await this.commissionService.ensureCommissionForShift(updated);
        }
        return updated;
    }

    /**
     * Starts a new shift for a chatter and models.
     * @param chatterId Chatter identifier.
     * @param modelIds Model identifiers.
     */
    public async clockIn(chatterId: number, modelIds: number[]): Promise<ShiftModel> {
        const now = new Date();
        return this.shiftRepo.create({
            chatterId,
            modelIds,
            date: now,
            start_time: now,
            end_time: null,
            status: "active",
        });
    }

    /**
     * Completes a shift by setting its end time.
     * @param id Shift identifier.
     */
    public async clockOut(id: number): Promise<ShiftModel | null> {
        console.log(`Clocking out shift with ID: ${id}`);
        const existing = await this.shiftRepo.findById(id);
        if (!existing) {
            return null;
        }
        const now = new Date();
        const updated = await this.shiftRepo.update(id, {
            end_time: now,
            status: "completed",
        });
        if (updated && existing.status !== "completed" && updated.status === "completed") {
            await this.commissionService.ensureCommissionForShift(updated);
        }
        return updated;
    }

    /**
     * Deletes a shift.
     * @param id Shift identifier.
     */
    public async delete(id: number): Promise<void> {
        await this.shiftRepo.delete(id);
    }

    /**
     * Retrieves the active shift for a chatter.
     * @param chatterId Chatter identifier.
     */
    public async getActiveTimeEntry(chatterId: number): Promise<ShiftModel | null> {
        return this.shiftRepo.getActiveTimeEntry(chatterId);
    }
}
