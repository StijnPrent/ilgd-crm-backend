/**
 * CompanyRepository module.
 */
import { BaseRepository } from "./BaseRepository";
import { ICompanyRepository, CompanyCreateInput, CompanyUpdateInput } from "../interfaces/ICompanyRepository";
import { CompanyModel } from "../../business/models/CompanyModel";
import { ResultSetHeader, RowDataPacket } from "mysql2";

/**
 * CompanyRepository class.
 */
export class CompanyRepository extends BaseRepository implements ICompanyRepository {
    public async findAll(): Promise<CompanyModel[]> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, name, slug, currency, timezone, created_at, updated_at FROM companies ORDER BY name ASC",
            [],
        );
        return rows.map(CompanyModel.fromRow);
    }

    public async findById(id: number): Promise<CompanyModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, name, slug, currency, timezone, created_at, updated_at FROM companies WHERE id = ?",
            [id],
        );
        return rows.length ? CompanyModel.fromRow(rows[0]) : null;
    }

    public async findBySlug(slug: string): Promise<CompanyModel | null> {
        const rows = await this.execute<RowDataPacket[]>(
            "SELECT id, name, slug, currency, timezone, created_at, updated_at FROM companies WHERE slug = ?",
            [slug],
        );
        return rows.length ? CompanyModel.fromRow(rows[0]) : null;
    }

    public async create(data: CompanyCreateInput): Promise<CompanyModel> {
        const result = await this.execute<ResultSetHeader>(
            "INSERT INTO companies (name, slug, currency, timezone) VALUES (?, ?, ?, ?)",
            [data.name, data.slug ?? null, data.currency ?? null, data.timezone ?? null],
        );
        const created = await this.findById(Number(result.insertId));
        if (!created) {
            throw new Error("Failed to fetch created company");
        }
        return created;
    }

    public async update(id: number, data: CompanyUpdateInput): Promise<CompanyModel | null> {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }
        await this.execute<ResultSetHeader>(
            "UPDATE companies SET name = ?, slug = ?, currency = ?, timezone = ?, updated_at = NOW() WHERE id = ?",
            [
                data.name ?? existing.name,
                data.slug ?? existing.slug,
                data.currency ?? existing.currency,
                data.timezone ?? existing.timezone,
                id,
            ],
        );
        return this.findById(id);
    }

    public async delete(id: number): Promise<void> {
        await this.execute<ResultSetHeader>(
            "DELETE FROM companies WHERE id = ?",
            [id],
        );
    }
}
