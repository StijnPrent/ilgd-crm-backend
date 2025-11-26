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
import { ICompanyRepository } from "../../data/interfaces/ICompanyRepository";
import { BUSINESS_TIMEZONE, parseDateAssumingZone, startOfBusinessDayUtc } from "../../utils/Time";

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
        @inject("ICompanyRepository") private companyRepo: ICompanyRepository,
    ) {}

    /**
     * Returns all shifts.
     */
    public async getAll(filters?: {companyId?: number; from?: Date; to?: Date; chatterId?: number;}): Promise<ShiftModel[]> {
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
            companyId: number;
            chatterId: number;
            modelIds: number[];
            date: Date | string;
            start_time: Date | string;
            end_time?: Date | string | null;
            status: ShiftStatus;
        },
        options?: { repeatWeekly?: boolean; repeatWeeks?: number; }
    ): Promise<ShiftModel> {
        const tz = await this.getCompanyTimezone(data.companyId);
        const normalized = this.normalizeShiftPayload(data, tz);
        const created = await this.shiftRepo.create(normalized);
        const repeatWeekly = options?.repeatWeekly ?? false;
        const repeatWeeks = options?.repeatWeeks ?? 0;

        if (repeatWeekly && repeatWeeks > 0) {
            const timeZone = tz;
            const baseDateInput = data.date;
            const utcDate = typeof baseDateInput === "string" ? new Date(baseDateInput) : baseDateInput;
            const baseDateString = typeof baseDateInput === "string"
                ? baseDateInput
                : formatInTimeZone(baseDateInput, timeZone, "yyyy-MM-dd");
            const baseDateForCalculation = new Date(`${baseDateString}T00:00:00Z`);

            const isStartTimeString = typeof data.start_time === "string";
            const isEndTimeString = typeof data.end_time === "string";
            const baseStartTime = isStartTimeString ? this.extractTimePart(data.start_time as string, timeZone) : null;
            const baseEndTime = isEndTimeString ? this.extractTimePart(data.end_time as string, timeZone) : null;

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

                const repeated = this.normalizeShiftPayload({
                    ...data,
                    date: nextDateValue,
                    start_time: nextStart,
                    end_time: nextEnd,
                }, tz);
                await this.shiftRepo.create(repeated);
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
        companyId?: number;
        chatterId?: number;
        modelIds?: number[];
        date?: Date | string;
        start_time?: Date | string;
        end_time?: Date | string | null;
        status?: ShiftStatus;
    }): Promise<ShiftModel | null> {
        const existing = await this.shiftRepo.findById(id);
        if (!existing) return null;
        const tz = await this.getCompanyTimezone(data.companyId ?? existing.companyId);
        const normalized = this.normalizeShiftPayload({
            companyId: data.companyId ?? existing.companyId,
            chatterId: data.chatterId ?? existing.chatterId,
            modelIds: data.modelIds ?? existing.modelIds,
            date: data.date ?? existing.date,
            start_time: data.start_time ?? existing.startTime,
            end_time: data.end_time ?? existing.endTime,
            status: data.status ?? existing.status,
        }, tz);

        const updated = await this.shiftRepo.update(id, normalized);
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
    public async clockIn(chatterId: number, modelIds: number[], companyId: number): Promise<ShiftModel> {
        const now = new Date();
        const tz = await this.getCompanyTimezone(companyId);
        const payload = this.normalizeShiftPayload({
            companyId,
            chatterId,
            modelIds,
            date: now,
            start_time: now,
            end_time: null,
            status: "active",
        }, tz);
        return this.shiftRepo.create(payload);
    }

    /**
     * Completes a shift by setting its end time.
     * @param id Shift identifier.
     */
    public async clockOut(id: number, companyId?: number): Promise<ShiftModel | null> {
        console.log(`Clocking out shift with ID: ${id}`);
        const existing = await this.shiftRepo.findById(id);
        if (!existing) {
            return null;
        }
        const now = new Date();
        const updated = await this.shiftRepo.update(id, {
            companyId: companyId ?? existing.companyId,
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

    private async getCompanyTimezone(companyId: number): Promise<string> {
        try {
            const company = await this.companyRepo.findById(companyId);
            return company?.timezone ?? BUSINESS_TIMEZONE;
        } catch {
            return BUSINESS_TIMEZONE;
        }
    }

    private normalizeShiftPayload<T extends {
        companyId: number;
        chatterId: number;
        modelIds: number[];
        date: Date | string;
        start_time: Date | string;
        end_time?: Date | string | null;
        status: ShiftStatus;
    }>(data: T, timezone: string): T {
        const toUtc = (value: Date | string | null | undefined): Date | null | undefined => {
            if (value === null || value === undefined) return value;
            return parseDateAssumingZone(value, timezone);
        };

        const normalizedDate = startOfBusinessDayUtc(parseDateAssumingZone(data.date, timezone), timezone);
        const normalizedStart = toUtc(data.start_time)!;
        const normalizedEnd = toUtc(data.end_time ?? null);

        return {
            ...data,
            date: normalizedDate,
            start_time: normalizedStart,
            end_time: normalizedEnd ?? null,
        };
    }

    private extractTimePart(value: string | Date, timezone: string = BUSINESS_TIMEZONE): string {
        if (typeof value === "string") {
            const [, rawTime = value] = value.split("T");
            return rawTime.substring(0, 8);
        }
        return formatInTimeZone(value, timezone, "HH:mm:ss");
    }
}
