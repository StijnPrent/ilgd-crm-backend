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
        companyId?: number;
        limit?: number;
        offset?: number;
        chatterId?: number;
        types?: string[];
        date?: Date;
        from?: Date;
        to?: Date;
        shiftId?: number;
        modelId?: number;
    }): Promise<EmployeeEarningModel[]>;
    totalCount(params?: {
        companyId?: number;
        chatterId?: number;
        types?: string[];
        modelId?: number;
        date?: Date;
        from?: Date;
        to?: Date;
        shiftId?: number;
    }): Promise<number>;
    findById(id: string, params?: { companyId?: number }): Promise<EmployeeEarningModel | null>;
    create(data: {
        id?: string;
        companyId: number;
        chatterId: number | null;
        modelId: number | null;
        shiftId?: number | null;
        date: Date;
        amount: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel>;
    update(id: string, data: {
        companyId?: number;
        chatterId?: number | null;
        modelId?: number | null;
        shiftId?: number | null;
        date?: Date;
        amount?: number;
        description?: string | null;
        type?: string | null;
    }): Promise<EmployeeEarningModel | null>;
    delete(id: string): Promise<void>;
    getLastId(): Promise<string | null>;

    findByChatter(chatterId: number, params?: { companyId?: number }): Promise<EmployeeEarningModel[]>;

    getLeaderboard(params: {
        companyId?: number;
        startOfWeek: Date;
        startOfMonth: Date;
        from?: Date;
        to?: Date;
    }): Promise<{
        chatterId: number;
        chatterName: string;
        weekAmount: number;
        monthAmount: number;
    }[]>;

    findWithoutChatterBetween(start: Date, end: Date, params?: { companyId?: number }): Promise<EmployeeEarningModel[]>;

    findAllWithCommissionRates(params?: {companyId?: number; from?: Date; to?: Date;}): Promise<RevenueModel[]>;
    getTotalAmount(params?: {companyId?: number; from?: Date; to?: Date;}): Promise<number>;
    sumAmountForWindow(params: {
        companyId: number;
        from: Date;
        to: Date;
        workerId?: number | null;
        includeRefunds?: boolean;
    }): Promise<number>;

    // Sum earnings for a worker across all their shifts that belong to the given business date.
    // Uses shift.date to group, and sums earnings where ee.date is between each shift's start_time and end_time.
    sumAmountForWorkerShiftsOnDate(params: {
        companyId: number;
        workerId: number;
        businessDate: Date; // date-only semantics
        includeRefunds?: boolean;
    }): Promise<number>;
}
