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
import {ShiftRequestService} from "../business/services/ShiftRequestService";
import {IShiftRequestRepository} from "../data/interfaces/IShiftRequestRepository";
import {ShiftRequestRepository} from "../data/repositories/ShiftRequestRepository";
import {CommissionService} from "../business/services/CommissionService";
import {ICommissionRepository} from "../data/interfaces/ICommissionRepository";
import {CommissionRepository} from "../data/repositories/CommissionRepository";
import {F2FUnlockSyncService} from "../business/services/F2FUnlockSyncService";
import {F2FTransactionSyncService} from "../business/services/F2FTransactionSyncService";
import {IF2FCookieSettingRepository} from "../data/interfaces/IF2FCookieSettingRepository";
import {F2FCookieSettingRepository} from "../data/repositories/F2FCookieSettingRepository";
import {ModelService} from "../business/services/ModelService";
import {IModelRepository} from "../data/interfaces/IModelRepository";
import {ModelRepository} from "../data/repositories/ModelRepository";
import {RevenueService} from "../business/services/RevenueService";
import {AnalyticsService} from "../business/services/AnalyticsService";
import {BonusService} from "../business/services/BonusService";
import {BonusEvaluationService} from "../business/services/BonusEvaluationService";
import {IBonusRuleRepository} from "../data/interfaces/IBonusRuleRepository";
import {BonusRuleRepository} from "../data/repositories/BonusRuleRepository";
import {IBonusAwardRepository} from "../data/interfaces/IBonusAwardRepository";
import {BonusAwardRepository} from "../data/repositories/BonusAwardRepository";
import {IBonusProgressRepository} from "../data/interfaces/IBonusProgressRepository";
import {BonusProgressRepository} from "../data/repositories/BonusProgressRepository";
import {CompanyService} from "../business/services/CompanyService";
import {ICompanyRepository} from "../data/interfaces/ICompanyRepository";
import {CompanyRepository} from "../data/repositories/CompanyRepository";
import {BonusAutomationService} from "../business/services/BonusAutomationService";

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
container.register("ShiftRequestService", { useClass: ShiftRequestService });
container.register<IShiftRequestRepository>("IShiftRequestRepository", {
    useClass: ShiftRequestRepository,
});

container.register("CommissionService", { useClass: CommissionService });
container.register<ICommissionRepository>("ICommissionRepository", {
    useClass: CommissionRepository,
});
container.register("ModelService", { useClass: ModelService });
container.register<IModelRepository>("IModelRepository", {
    useClass: ModelRepository,
});
container.register<IF2FCookieSettingRepository>("IF2FCookieSettingRepository", {
    useClass: F2FCookieSettingRepository,
});
container.register("F2FUnlockSyncService", { useClass: F2FUnlockSyncService });
container.registerSingleton(F2FTransactionSyncService);
container.register("RevenueService", { useClass: RevenueService });
container.register("AnalyticsService", { useClass: AnalyticsService });
container.register("BonusService", { useClass: BonusService });
container.register("BonusEvaluationService", { useClass: BonusEvaluationService });
container.register<IBonusRuleRepository>("IBonusRuleRepository", { useClass: BonusRuleRepository });
container.register<IBonusAwardRepository>("IBonusAwardRepository", { useClass: BonusAwardRepository });
container.register<IBonusProgressRepository>("IBonusProgressRepository", { useClass: BonusProgressRepository });
container.register("BonusAutomationService", { useClass: BonusAutomationService });
container.register("CompanyService", { useClass: CompanyService });
container.register<ICompanyRepository>("ICompanyRepository", { useClass: CompanyRepository });
