import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";

export interface IEmployeeEarningRepository {
    findAll(): Promise<EmployeeEarningModel[]>;
    findById(id: string): Promise<EmployeeEarningModel | null>;
    create(data: {
        id?: string;
        chatterId?: number | null;
        date: Date;
        amount: number;
        description?: string | null;
    }): Promise<EmployeeEarningModel>;
    update(id: string, data: {
        chatterId?: number | null;
        date?: Date;
        amount?: number;
        description?: string | null;
    }): Promise<EmployeeEarningModel | null>;
    delete(id: string): Promise<void>;
    getLastId(): Promise<string | null>;
}
