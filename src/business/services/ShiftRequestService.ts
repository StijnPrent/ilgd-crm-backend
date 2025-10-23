/**
 * ShiftRequestService module.
 */
import {inject, injectable} from "tsyringe";
import {ShiftRequestModel} from "../models/ShiftRequestModel";
import {
    CreateShiftRequestInput,
    IShiftRequestRepository,
    ShiftRequestFilters,
    UpdateShiftRequestInput,
} from "../../data/interfaces/IShiftRequestRepository";

@injectable()
export class ShiftRequestService {
    constructor(
        @inject("IShiftRequestRepository") private shiftRequestRepo: IShiftRequestRepository,
    ) {}

    public getAll(filters?: ShiftRequestFilters): Promise<ShiftRequestModel[]> {
        return this.shiftRequestRepo.findAll(filters);
    }

    public create(data: CreateShiftRequestInput): Promise<ShiftRequestModel> {
        return this.shiftRequestRepo.create(data);
    }

    public update(id: number, data: UpdateShiftRequestInput): Promise<ShiftRequestModel | null> {
        return this.shiftRequestRepo.update(id, data);
    }
}
