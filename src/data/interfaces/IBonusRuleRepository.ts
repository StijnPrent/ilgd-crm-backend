/**
 * IBonusRuleRepository module.
 */
import { BonusRuleModel } from "../../business/models/BonusRuleModel";
import { BonusScope } from "../../business/bonus/BonusTypes";

export interface BonusRuleQuery {
    companyId?: number;
    isActive?: boolean;
    scope?: BonusScope;
}

export interface BonusRuleCreateInput {
    companyId: number;
    name: string;
    isActive: boolean;
    priority: number;
    scope: BonusScope;
    windowType: string;
    windowSeconds: number | null;
    ruleType: string;
    ruleConfig: any;
}

export interface BonusRuleUpdateInput {
    name?: string;
    isActive?: boolean;
    priority?: number;
    scope?: BonusScope;
    windowType?: string;
    windowSeconds?: number | null;
    ruleType?: string;
    ruleConfig?: any;
}

export interface IBonusRuleRepository {
    findAll(params?: BonusRuleQuery): Promise<BonusRuleModel[]>;
    findById(id: number): Promise<BonusRuleModel | null>;
    findActiveByCompany(companyId: number): Promise<BonusRuleModel[]>;
    create(data: BonusRuleCreateInput): Promise<BonusRuleModel>;
    update(id: number, data: BonusRuleUpdateInput): Promise<BonusRuleModel | null>;
}
