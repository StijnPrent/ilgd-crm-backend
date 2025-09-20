/**
 * ShiftService module.
 */
import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {ShiftModel} from "../models/ShiftModel";
import {ShiftStatus} from "../../rename/types";
import {CommissionService} from "./CommissionService";
import { addWeeks } from "date-fns";
import {formatInTimeZone} from "date-fns-tz";

/**
 * Service responsible for shift management.
 */
@injectable()
/**
 * ShiftService class.
 */
export class ShiftService {
    private static readonly SHIFT_TIME_ZONE = "Europe/Amsterdam";

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
        data: {
            chatterId: number;
            modelIds: number[];
            date: Date | string;
            start_time: Date | string;
            end_time?: Date | string | null;
            status: ShiftStatus;
        },
        options?: { repeatWeekly?: boolean; repeatWeeks?: number; }
    ): Promise<ShiftModel> {
        const created = await this.shiftRepo.create(data);
        const repeatWeekly = options?.repeatWeekly ?? false;
        const repeatWeeks = options?.repeatWeeks ?? 0;

        if (repeatWeekly && repeatWeeks > 0) {
            const timeZone = ShiftService.SHIFT_TIME_ZONE;
            const baseDateInput = data.date;
            const utcDate = typeof baseDateInput === "string" ? new Date(baseDateInput) : baseDateInput;
            const baseDateString = typeof baseDateInput === "string"
                ? baseDateInput
                : formatInTimeZone(baseDateInput, timeZone, "yyyy-MM-dd");
            const baseDateForCalculation = new Date(`${baseDateString}T00:00:00Z`);

            const isStartTimeString = typeof data.start_time === "string";
            const isEndTimeString = typeof data.end_time === "string";
            const baseStartTime = isStartTimeString ? this.extractTimePart(data.start_time as string) : null;
            const baseEndTime = isEndTimeString ? this.extractTimePart(data.end_time as string) : null;

            for (let i = 1; i <= repeatWeeks; i++) {
                const nextDateCalculation = addWeeks(baseDateForCalculation, i);
                const nextDateString = formatInTimeZone(nextDateCalculation, timeZone, "yyyy-MM-dd");
                const nextDateValue = typeof baseDateInput === "string"
                    ? nextDateString
                    : addWeeks(baseDateInput, i);

                const nextStart = isStartTimeString
                    ? `${nextDateString}T${baseStartTime}`
                    : addWeeks(data.start_time as Date, i);
                const nextEnd = data.end_time == null
                    ? null
                    : isEndTimeString
                        ? `${nextDateString}T${baseEndTime}`
                        : addWeeks(data.end_time as Date, i);

                await this.shiftRepo.create({
                    ...data,
                    date: nextDateValue,
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
    public async update(id: number, data: {
        chatterId?: number;
        modelIds?: number[];
        date?: Date | string;
        start_time?: Date | string;
        end_time?: Date | string | null;
        status?: ShiftStatus;
    }): Promise<ShiftModel | null> {
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

    private extractTimePart(value: string | Date): string {
        const timeZone = ShiftService.SHIFT_TIME_ZONE;
        if (typeof value === "string") {
            const [, rawTime = value] = value.split("T");
            return rawTime.substring(0, 8);
        }
        return formatInTimeZone(value, timeZone, "HH:mm:ss");
    }
}
