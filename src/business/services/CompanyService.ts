/**
 * CompanyService module.
 */
import { inject, injectable } from "tsyringe";
import { ICompanyRepository, CompanyCreateInput, CompanyUpdateInput } from "../../data/interfaces/ICompanyRepository";
import { CompanyModel } from "../models/CompanyModel";

/**
 * Service managing companies.
 */
@injectable()
export class CompanyService {
    constructor(
        @inject("ICompanyRepository") private companyRepo: ICompanyRepository,
    ) {}

    public async getAll(): Promise<CompanyModel[]> {
        return this.companyRepo.findAll();
    }

    public async getById(id: number): Promise<CompanyModel | null> {
        return this.companyRepo.findById(id);
    }

    public async getBySlug(slug: string): Promise<CompanyModel | null> {
        return this.companyRepo.findBySlug(slug);
    }

    public async create(data: CompanyCreateInput): Promise<CompanyModel> {
        return this.companyRepo.create(data);
    }

    public async update(id: number, data: CompanyUpdateInput): Promise<CompanyModel | null> {
        return this.companyRepo.update(id, data);
    }

    public async delete(id: number): Promise<void> {
        await this.companyRepo.delete(id);
    }
}
