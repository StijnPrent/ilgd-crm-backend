/**
 * ICompanyRepository module.
 */
import { CompanyModel } from "../../business/models/CompanyModel";

export interface CompanyCreateInput {
    name: string;
    slug?: string | null;
    currency?: string | null;
    timezone?: string | null;
}

export interface CompanyUpdateInput {
    name?: string;
    slug?: string | null;
    currency?: string | null;
    timezone?: string | null;
}

export interface ICompanyRepository {
    findAll(): Promise<CompanyModel[]>;
    findById(id: number): Promise<CompanyModel | null>;
    findBySlug(slug: string): Promise<CompanyModel | null>;
    create(data: CompanyCreateInput): Promise<CompanyModel>;
    update(id: number, data: CompanyUpdateInput): Promise<CompanyModel | null>;
    delete(id: number): Promise<void>;
}
