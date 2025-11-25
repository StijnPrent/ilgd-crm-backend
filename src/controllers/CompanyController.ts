/**
 * CompanyController module.
 */
import { Request, Response } from "express";
import { container } from "tsyringe";
import { CompanyService } from "../business/services/CompanyService";

function parseNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
}

export class CompanyController {
    private get service(): CompanyService {
        return container.resolve(CompanyService);
    }

    public async list(_req: Request, res: Response): Promise<void> {
        try {
            const companies = await this.service.getAll();
            res.json(companies.map(c => c.toJSON()));
        } catch (err) {
            console.error("[company] list error", err);
            res.status(500).json({ message: "Failed to fetch companies" });
        }
    }

    public async get(req: Request, res: Response): Promise<void> {
        try {
            const id = parseNumber(req.params.id);
            if (!id) {
                res.status(400).json({ message: "Invalid company id" });
                return;
            }
            const company = await this.service.getById(id);
            if (!company) {
                res.status(404).json({ message: "Company not found" });
                return;
            }
            res.json(company.toJSON());
        } catch (err) {
            console.error("[company] get error", err);
            res.status(500).json({ message: "Failed to fetch company" });
        }
    }

    public async create(req: Request, res: Response): Promise<void> {
        try {
            const { name, slug, currency, timezone } = req.body ?? {};
            if (!name || typeof name !== "string") {
                res.status(400).json({ message: "name is required" });
                return;
            }
            const company = await this.service.create({
                name,
                slug: typeof slug === "string" ? slug : null,
                currency: typeof currency === "string" ? currency : null,
                timezone: typeof timezone === "string" ? timezone : null,
            });
            res.status(201).json(company.toJSON());
        } catch (err) {
            console.error("[company] create error", err);
            res.status(500).json({ message: "Failed to create company" });
        }
    }

    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = parseNumber(req.params.id);
            if (!id) {
                res.status(400).json({ message: "Invalid company id" });
                return;
            }
            const { name, slug, currency, timezone } = req.body ?? {};
            const updated = await this.service.update(id, {
                name: typeof name === "string" ? name : undefined,
                slug: typeof slug === "string" ? slug : undefined,
                currency: typeof currency === "string" ? currency : undefined,
                timezone: typeof timezone === "string" ? timezone : undefined,
            });
            if (!updated) {
                res.status(404).json({ message: "Company not found" });
                return;
            }
            res.json(updated.toJSON());
        } catch (err) {
            console.error("[company] update error", err);
            res.status(500).json({ message: "Failed to update company" });
        }
    }

    public async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = parseNumber(req.params.id);
            if (!id) {
                res.status(400).json({ message: "Invalid company id" });
                return;
            }
            await this.service.delete(id);
            res.sendStatus(204);
        } catch (err) {
            console.error("[company] delete error", err);
            res.status(500).json({ message: "Failed to delete company" });
        }
    }
}
