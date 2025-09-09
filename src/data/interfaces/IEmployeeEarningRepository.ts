import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";

export interface IEmployeeEarningRepository {
    findAll(params?: {
        limit?: number;
        offset?: number;
        chatterId?: number;
        type?: string;
    }): Promise<EmployeeEarningModel[]>;
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

    findAllWithCommissionRates(): Promise<{
        id: string;
        amount: number;
        modelId: number | null;
        modelCommissionRate: number | null;
        chatterId: number | null;
        chatterCommissionRate: number | null;
    }[]>;
}
