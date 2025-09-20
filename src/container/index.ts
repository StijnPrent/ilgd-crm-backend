/**
 * index module.
 */
import {container} from "tsyringe";
import {UserService} from "../business/services/UserService";
import {IUserRepository} from "../data/interfaces/IUserRepository";
import {UserRepository} from "../data/repositories/UserRepository";
import {ChatterService} from "../business/services/ChatterService";
import {IChatterRepository} from "../data/interfaces/IChatterRepository";
import {ChatterRepository} from "../data/repositories/ChatterRepository";
import {EmployeeEarningService} from "../business/services/EmployeeEarningService";
import {IEmployeeEarningRepository} from "../data/interfaces/IEmployeeEarningRepository";
import {EmployeeEarningRepository} from "../data/repositories/EmployeeEarningRepository";
import {ShiftService} from "../business/services/ShiftService";
import {IShiftRepository} from "../data/interfaces/IShiftRepository";
import {ShiftRepository} from "../data/repositories/ShiftRepository";
import {CommissionService} from "../business/services/CommissionService";
import {ICommissionRepository} from "../data/interfaces/ICommissionRepository";
import {CommissionRepository} from "../data/repositories/CommissionRepository";
import {F2FUnlockSyncService} from "../business/services/F2FUnlockSyncService";
import {F2FTransactionSyncService} from "../business/services/F2FTransactionSyncService";
import {ModelService} from "../business/services/ModelService";
import {IModelRepository} from "../data/interfaces/IModelRepository";
import {ModelRepository} from "../data/repositories/ModelRepository";
import {RevenueService} from "../business/services/RevenueService";
import {AnalyticsService} from "../business/services/AnalyticsService";

container.register("UserService", { useClass: UserService });

container.register<IUserRepository>("IUserRepository", {
    useClass: UserRepository,
});

container.register("ChatterService", { useClass: ChatterService });
container.register<IChatterRepository>("IChatterRepository", {
    useClass: ChatterRepository,
});

container.register("EmployeeEarningService", { useClass: EmployeeEarningService });
container.register<IEmployeeEarningRepository>("IEmployeeEarningRepository", {
    useClass: EmployeeEarningRepository,
});

container.register("ShiftService", { useClass: ShiftService });
container.register<IShiftRepository>("IShiftRepository", {
    useClass: ShiftRepository,
});

container.register("CommissionService", { useClass: CommissionService });
container.register<ICommissionRepository>("ICommissionRepository", {
    useClass: CommissionRepository,
});
container.register("ModelService", { useClass: ModelService });
container.register<IModelRepository>("IModelRepository", {
    useClass: ModelRepository,
});
container.register("F2FUnlockSyncService", { useClass: F2FUnlockSyncService });
container.registerSingleton(F2FTransactionSyncService);
container.register("RevenueService", { useClass: RevenueService });
container.register("AnalyticsService", { useClass: AnalyticsService });
