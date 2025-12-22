/**
 * ShiftService module.
 */
import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {ShiftModel} from "../models/ShiftModel";
import {ShiftStatus, ShiftBuyerRelationship} from "../../rename/types";
import {CommissionService} from "./CommissionService";
import { addWeeks } from "date-fns";
import {formatInTimeZone, toZonedTime} from "date-fns-tz";
import { ICompanyRepository } from "../../data/interfaces/ICompanyRepository";
import { BUSINESS_TIMEZONE, parseDateAssumingZone, startOfBusinessDayUtc } from "../../utils/Time";
import { randomUUID } from "crypto";

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
            modelBuyerRelationships?: Record<number, ShiftBuyerRelationship | null | undefined>;
            date: Date | string;
            start_time: Date | string;
            end_time?: Date | string | null;
            status: ShiftStatus;
            recurringGroupId?: string | null;
        },
        options?: { repeatWeekly?: boolean; repeatWeeks?: number; }
    ): Promise<ShiftModel> {
        const tz = await this.getCompanyTimezone(data.companyId);
        const baseRecurringGroupId = data.recurringGroupId ?? (options?.repeatWeekly ? randomUUID() : null);
        const normalized = this.normalizeShiftPayload({...data, recurringGroupId: baseRecurringGroupId}, tz);
        const created = await this.shiftRepo.create(normalized);
        const repeatWeekly = options?.repeatWeekly ?? false;
        const repeatWeeks = options?.repeatWeeks ?? 0;

        if (repeatWeekly && repeatWeeks > 0) {
            const baseDateUtc = normalized.date as Date;
            const baseStartUtc = normalized.start_time as Date;
            const baseEndUtc = normalized.end_time ? (normalized.end_time as Date) : null;

            for (let i = 1; i <= repeatWeeks; i++) {
                const nextDateUtc = addWeeks(baseDateUtc, i);
                const nextStartUtc = addWeeks(baseStartUtc, i);
                const nextEndUtc = baseEndUtc ? addWeeks(baseEndUtc, i) : null;

                const repeated = this.normalizeShiftPayload({
                    ...data,
                    recurringGroupId: baseRecurringGroupId,
                    date: nextDateUtc,
                    start_time: nextStartUtc,
                    end_time: nextEndUtc,
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
        modelBuyerRelationships?: Record<number, ShiftBuyerRelationship | null | undefined>;
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
            recurringGroupId: data.recurringGroupId ?? existing.recurringGroupId,
            modelBuyerRelationships: data.modelBuyerRelationships
                ?? (existing.modelBuyerRelationships ? Object.fromEntries(existing.modelBuyerRelationships) : undefined),
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

    public async deleteRecurring(
        recurringGroupId: string,
        fromDate: Date,
        companyId: number
    ): Promise<number> {
        const tz = await this.getCompanyTimezone(companyId);
        const parsed = parseDateAssumingZone(fromDate, tz);
        const cutoff = startOfBusinessDayUtc(parsed, tz); // normalized UTC at business-day start
        console.log(`Deleting recurring shifts with group ID: ${recurringGroupId} from date: ${cutoff.toISOString()}`);
        return this.shiftRepo.deleteByRecurringGroupFromDate(recurringGroupId, cutoff, companyId);
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
        modelBuyerRelationships?: Record<number, ShiftBuyerRelationship | null | undefined>;
        date: Date | string;
        start_time: Date | string;
        end_time?: Date | string | null;
        status: ShiftStatus;
        recurringGroupId?: string | null;
        modelBuyerRelationships?: Record<number, ShiftBuyerRelationship | null | undefined>;
    }>(data: T, timezone: string): T {
        const toUtc = (value: Date | string | null | undefined): Date | null | undefined => {
            if (value === null || value === undefined) return value;
            return parseDateAssumingZone(value, timezone);
        };

        const normalizedStart = toUtc(data.start_time)!;
        // Anchor the business date to the start_time's local calendar day, but store
        // it as UTC midnight of that local date to avoid shifting back a day.
        const zonedStart = toZonedTime(normalizedStart, timezone);
        const normalizedDate = new Date(Date.UTC(
            zonedStart.getFullYear(),
            zonedStart.getMonth(),
            zonedStart.getDate(),
            0, 0, 0, 0,
        ));
        const normalizedEnd = toUtc(data.end_time ?? null);

        return {
            ...data,
            date: normalizedDate,
            start_time: normalizedStart,
            end_time: normalizedEnd ?? null,
            modelBuyerRelationships: data.modelBuyerRelationships,
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
