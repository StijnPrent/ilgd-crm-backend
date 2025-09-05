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

    findAllWithChatter(): Promise<EmployeeEarningModel[]>;

    findAllWithCommissionRates(): Promise<{
        id: string;
        amount: number;
        modelId: number | null;
        modelCommissionRate: number | null;
        chatterId: number | null;
        chatterCommissionRate: number | null;
    }[]>;
}
