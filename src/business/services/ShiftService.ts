import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {ShiftModel} from "../models/ShiftModel";
import {ShiftStatus} from "../../rename/types";

/**
 * Service responsible for shift management.
 */
@injectable()
export class ShiftService {
    constructor(
        @inject("IShiftRepository") private shiftRepo: IShiftRepository
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
    public async create(data: { chatterId: number; modelIds: number[]; date: Date; start_time: Date; end_time?: Date | null; status: ShiftStatus; }): Promise<ShiftModel> {
        return this.shiftRepo.create(data);
    }

    /**
     * Updates an existing shift.
     * @param id Shift identifier.
     * @param data Partial shift data.
     */
    public async update(id: number, data: { chatterId?: number; modelIds?: number[]; date?: Date; start_time?: Date; end_time?: Date | null; status?: ShiftStatus; }): Promise<ShiftModel | null> {
        return this.shiftRepo.update(id, data);
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
        const now = new Date();
        return this.shiftRepo.update(id, {
            end_time: now,
            status: "completed",
        });
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
