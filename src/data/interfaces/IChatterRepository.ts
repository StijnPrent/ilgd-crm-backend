import {ChatterModel} from "../../business/models/ChatterModel";
import {ChatterStatus, CurrencySymbol} from "../../rename/types";

export interface IChatterRepository {
    findAll(): Promise<ChatterModel[]>;
    findById(id: number): Promise<ChatterModel | null>;
    create(data: {
        email: string;
        currency: CurrencySymbol;
        commissionRate: number;
        platformFee: number;
        status: ChatterStatus;
    }): Promise<ChatterModel>;
    update(id: number, data: {
        email?: string;
        currency?: CurrencySymbol;
        commissionRate?: number;
        platformFee?: number;
        status?: ChatterStatus;
    }): Promise<ChatterModel | null>;
    delete(id: number): Promise<void>;
}
