import {inject, injectable} from "tsyringe";
import {IChatterRepository} from "../../data/interfaces/IChatterRepository";
import {ChatterModel} from "../models/ChatterModel";
import {ChatterStatus, CurrencySymbol} from "../../rename/types";

@injectable()
export class ChatterService {
    constructor(
        @inject("IChatterRepository") private chatterRepo: IChatterRepository
    ) {}

    public async getAll(): Promise<ChatterModel[]> {
        return this.chatterRepo.findAll();
    }

    public async getById(id: number): Promise<ChatterModel | null> {
        return this.chatterRepo.findById(id);
    }

    public async create(data: { email: string; currency: CurrencySymbol; commissionRate: number; platformFee: number; status: ChatterStatus; }): Promise<ChatterModel> {
        return this.chatterRepo.create(data);
    }

    public async update(id: number, data: { email?: string; currency?: CurrencySymbol; commissionRate?: number; platformFee?: number; status?: ChatterStatus; }): Promise<ChatterModel | null> {
        return this.chatterRepo.update(id, data);
    }

    public async delete(id: number): Promise<void> {
        await this.chatterRepo.delete(id);
    }
}
