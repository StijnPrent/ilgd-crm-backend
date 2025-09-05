import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";

export interface IEmployeeEarningRepository {
    findAll(): Promise<EmployeeEarningModel[]>;
    findById(id: string): Promise<EmployeeEarningModel | null>;
    create(data: {
        id?: string;
        chatterId: number | null;
        modelId: number | null;
        date: Date;
        amount: number;
        description?: string | null;
    }): Promise<EmployeeEarningModel>;
    update(id: string, data: {
        chatterId?: number | null;
        modelId?: number | null;
        date?: Date;
        amount?: number;
        description?: string | null;
    }): Promise<EmployeeEarningModel | null>;
    delete(id: string): Promise<void>;
    getLastId(): Promise<string | null>;

    findAllWithCommissionRates(): Promise<{
        id: string;
        amount: number;
        modelId: number | null;
        modelCommissionRate: number | null;
        chatterId: number | null;
        chatterCommissionRate: number | null;
    }[]>;
}
