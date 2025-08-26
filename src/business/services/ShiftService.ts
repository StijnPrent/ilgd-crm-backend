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

    public async create(data: { chatterId: number; date: Date; start_time: Date; end_time: Date; status: ShiftStatus; }): Promise<ShiftModel> {
        return this.shiftRepo.create(data);
    }

    public async update(id: number, data: { chatterId?: number; date?: Date; start_time?: Date; end_time?: Date; status?: ShiftStatus; }): Promise<ShiftModel | null> {
        return this.shiftRepo.update(id, data);
    }

    public async delete(id: number): Promise<void> {
        await this.shiftRepo.delete(id);
    }
}
