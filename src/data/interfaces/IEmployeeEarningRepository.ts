import {EmployeeEarningModel} from "../../business/models/EmployeeEarningModel";

export interface IEmployeeEarningRepository {
    findAll(): Promise<EmployeeEarningModel[]>;
    findById(id: number): Promise<EmployeeEarningModel | null>;
    create(data: {
        chatterId: number;
        date: Date;
        amount: number;
        description?: string | null;
    }): Promise<EmployeeEarningModel>;
    update(id: number, data: {
        chatterId?: number;
        date?: Date;
        amount?: number;
        description?: string | null;
    }): Promise<EmployeeEarningModel | null>;
    delete(id: number): Promise<void>;
}
