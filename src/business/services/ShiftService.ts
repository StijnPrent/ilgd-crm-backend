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
    public async getAll(): Promise<ShiftModel[]> {
        const result = await this.shiftRepo.findAll();
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
    public async create(data: { chatterId: number; modelIds: number[]; date: Date; start_time: Date; end_time?: Date | null; status: ShiftStatus; isWeekly?: boolean; recurrenceParentId?: number | null; }): Promise<ShiftModel> {
        return this.shiftRepo.create({
            ...data,
            isWeekly: data.isWeekly ?? false,
            recurrenceParentId: data.recurrenceParentId ?? null,
        });
    }

    /**
     * Updates an existing shift.
     * @param id Shift identifier.
     * @param data Partial shift data.
     */
    public async update(id: number, data: { chatterId?: number; modelIds?: number[]; date?: Date; start_time?: Date; end_time?: Date | null; status?: ShiftStatus; isWeekly?: boolean; recurrenceParentId?: number | null; applyToSeries?: boolean; }): Promise<ShiftModel | null> {
        const applyToSeries = data.applyToSeries !== undefined ? data.applyToSeries : true;
        const {applyToSeries: _ignored, ...shiftData} = data;

        if (!applyToSeries) {
            const existing = await this.shiftRepo.findById(id);
            if (!existing) {
                return null;
            }

            if (!existing.isWeekly && existing.recurrenceParentId) {
                const updatedOverride = await this.shiftRepo.update(id, {
                    ...shiftData,
                    isWeekly: false,
                    recurrenceParentId: existing.recurrenceParentId,
                });

                if (updatedOverride && updatedOverride.status === "completed") {
                    await this.commissionService.ensureCommissionForShift(updatedOverride);
                }

                return updatedOverride;
            }

            const override = await this.shiftRepo.create({
                chatterId: shiftData.chatterId ?? existing.chatterId,
                modelIds: shiftData.modelIds ?? existing.modelIds,
                date: shiftData.date ?? existing.date,
                start_time: shiftData.start_time ?? existing.startTime,
                end_time: shiftData.end_time ?? existing.endTime ?? null,
                status: shiftData.status ?? existing.status,
                isWeekly: false,
                recurrenceParentId: existing.recurrenceParentId ?? existing.id,
            });

            if (override && override.status === "completed") {
                await this.commissionService.ensureCommissionForShift(override);
            }

            return override;
        }

        const updated = await this.shiftRepo.update(id, shiftData);
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
            isWeekly: false,
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
