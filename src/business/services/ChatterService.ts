import {inject, injectable} from "tsyringe";
import {IChatterRepository} from "../../data/interfaces/IChatterRepository";
import {ChatterModel} from "../models/ChatterModel";
import {ChatterStatus, CurrencySymbol} from "../../rename/types";

/**
 * Service providing operations for chatters.
 */
@injectable()
export class ChatterService {
    constructor(
        @inject("IChatterRepository") private chatterRepo: IChatterRepository
    ) {}

    /**
     * Returns all chatters.
     */
    public async getAll(): Promise<ChatterModel[]> {
        return this.chatterRepo.findAll();
    }

    /**
     * Retrieves a chatter by ID.
     * @param id Chatter identifier.
     */
    public async getById(id: number): Promise<ChatterModel | null> {
        return this.chatterRepo.findById(id);
    }

    /**
     * Creates a new chatter.
     * @param data Chatter details.
     */
    public async create(data: {userId: number, email: string; currency: CurrencySymbol; commissionRate: number; platformFeeRate: number; status: ChatterStatus; }): Promise<ChatterModel> {
        return this.chatterRepo.create(data);
    }

    /**
     * Updates an existing chatter.
     * @param id Chatter identifier.
     * @param data Partial chatter data.
     */
    public async update(id: number, data: { email?: string; currency?: CurrencySymbol; commissionRate?: number; platformFee?: number; status?: ChatterStatus; }): Promise<ChatterModel | null> {
        return this.chatterRepo.update(id, data);
    }

    /**
     * Deletes a chatter by ID.
     * @param id Chatter identifier.
     */
    public async delete(id: number): Promise<void> {
        await this.chatterRepo.delete(id);
    }
}
