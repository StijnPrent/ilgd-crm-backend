import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {ShiftModel} from "../models/ShiftModel";
import {ShiftStatus} from "../../rename/types";

@injectable()
export class ShiftService {
    constructor(
        @inject("IShiftRepository") private shiftRepo: IShiftRepository
    ) {}

    public async getAll(): Promise<ShiftModel[]> {
        return this.shiftRepo.findAll();
    }

    public async getById(id: number): Promise<ShiftModel | null> {
        return this.shiftRepo.findById(id);
    }

    public async create(data: { chatterId: number; date: Date; start_time: Date; end_time?: Date | null; status: ShiftStatus; }): Promise<ShiftModel> {
        return this.shiftRepo.create(data);
    }

    public async update(id: number, data: { chatterId?: number; date?: Date; start_time?: Date; end_time?: Date | null; status?: ShiftStatus; }): Promise<ShiftModel | null> {
        return this.shiftRepo.update(id, data);
    }

    public async clockIn(chatterId: number): Promise<ShiftModel> {
        const now = new Date();
        return this.shiftRepo.create({
            chatterId,
            date: now,
            start_time: now,
            end_time: null,
            status: "active",
        });
    }

    public async clockOut(id: number): Promise<ShiftModel | null> {
        const now = new Date();
        return this.shiftRepo.update(id, {
            end_time: now,
            status: "completed",
        });
    }

    public async delete(id: number): Promise<void> {
        await this.shiftRepo.delete(id);
    }
}
