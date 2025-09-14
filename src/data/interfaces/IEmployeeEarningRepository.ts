/**
 * IEmployeeEarningRepository module.
 */
import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";
import {RevenueModel} from "../../business/models/RevenueModel";

/**
 * IEmployeeEarningRepository interface.
 */
export interface IEmployeeEarningRepository {
    findAll(params?: {
        limit?: number;
        offset?: number;
        chatterId?: number;
        type?: string;
        date?: Date;
    }): Promise<EmployeeEarningModel[]>;
    totalCount(params?: { chatterId?: number; type?: string; modelId?: number; date?: Date }): Promise<number>;
    findById(id: string): Promise<EmployeeEarningModel | null>;
    create(data: {
        id?: string;
        chatterId: number | null;
        modelId: number | null;
        date: Date;
        amount: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel>;
    update(id: string, data: {
        chatterId?: number | null;
        modelId?: number | null;
        date?: Date;
        amount?: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel | null>;
    delete(id: string): Promise<void>;
    getLastId(): Promise<string | null>;

    findByChatter(chatterId: number): Promise<EmployeeEarningModel[]>;

    getLeaderboard(startOfWeek: Date, startOfMonth: Date): Promise<{
        chatterId: number;
        chatterName: string;
        weekAmount: number;
        monthAmount: number;
    }[]>;

    findWithoutChatterBetween(start: Date, end: Date): Promise<EmployeeEarningModel[]>;

    findAllWithCommissionRates(): Promise<RevenueModel[]>;
}
