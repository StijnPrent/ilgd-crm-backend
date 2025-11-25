import { Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { AuthenticatedRequest } from "../middleware/auth";
import { IF2FCookieSettingRepository } from "../data/interfaces/IF2FCookieSettingRepository";
import { IUserRepository } from "../data/interfaces/IUserRepository";
import { CompanyUpdateInput } from "../data/interfaces/ICompanyRepository";
import { Role } from "../rename/types";
import { CompanyService } from "../business/services/CompanyService";

interface ManagerRequest extends AuthenticatedRequest {
    currentUser?: { id: number; role: Role; fullName: string };
}

interface GetCookiesResponse {
    cookies: string;
    updatedAt: string | null;
    updatedBy: { id: string; name: string | null } | null;
}

@injectable()
export class SettingsController {
    constructor(
        @inject("IF2FCookieSettingRepository") private repository: IF2FCookieSettingRepository,
        @inject("IUserRepository") private userRepository: IUserRepository,
        @inject("CompanyService") private companyService: CompanyService,
    ) {}

    public ensureManager = async (req: ManagerRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (req.userId === undefined) {
                res.sendStatus(401);
                return;
            }

            const user = await this.userRepository.findById(Number(req.userId));
            if (!user || user.role !== "manager") {
                res.sendStatus(403);
                return;
            }
            if (req.companyId !== undefined && user.companyId !== req.companyId) {
                res.sendStatus(403);
                return;
            }

            req.currentUser = {
                id: user.id,
                role: user.role,
                fullName: user.fullName,
            };

            next();
        } catch (error) {
            console.error("[SettingsController.ensureManager]", error);
            res.status(500).json({ error: "Failed to authorize request" });
        }
    };

    private formatResponse(record: Awaited<ReturnType<IF2FCookieSettingRepository["getF2FCookies"]>>): GetCookiesResponse {
        if (!record) {
            return { cookies: "", updatedAt: null, updatedBy: null };
        }

        const updatedAt = record.updatedById ? record.updatedAt?.toISOString() ?? null : null;
        const updatedBy = record.updatedById ? { id: record.updatedById, name: record.updatedByName ?? null } : null;

        return {
            cookies: record.cookies,
            updatedAt,
            updatedBy,
        };
    }

    public getCookies = async (req: ManagerRequest, res: Response): Promise<void> => {
        try {
            if (req.companyId === undefined) {
                res.sendStatus(400);
                return;
            }
            const record = await this.repository.getF2FCookies({ companyId: req.companyId });
            res.json(this.formatResponse(record));
        } catch (error) {
            console.error("[SettingsController.getCookies]", error);
            res.status(500).json({ error: "Failed to load Face2Face cookies" });
        }
    };

    public getCompanySettings = async (req: ManagerRequest, res: Response): Promise<void> => {
        try {
            if (req.companyId === undefined) {
                res.sendStatus(400);
                return;
            }
            const company = await this.companyService.getById(req.companyId);
            if (!company) {
                res.status(404).json({ error: "Company not found" });
                return;
            }
            res.json(company.toJSON());
        } catch (error) {
            console.error("[SettingsController.getCompanySettings]", error);
            res.status(500).json({ error: "Failed to load company settings" });
        }
    };

    public updateCompanySettings = async (req: ManagerRequest, res: Response): Promise<void> => {
        try {
            if (req.companyId === undefined) {
                res.sendStatus(400);
                return;
            }

            const payload = req.body ?? {};
            const name = typeof payload.name === "string" ? payload.name : undefined;
            const currency = typeof payload.currency === "string" ? payload.currency : undefined;
            const timezoneRaw = payload.timezone ?? payload.timeZone;
            const timezone = typeof timezoneRaw === "string" ? timezoneRaw : undefined;

            const updatePayload: CompanyUpdateInput = {};
            if (name !== undefined) {
                updatePayload.name = name;
            }
            if (currency !== undefined) {
                updatePayload.currency = currency;
            }
            if (timezone !== undefined) {
                updatePayload.timezone = timezone;
            }

            const updated = await this.companyService.update(req.companyId, updatePayload);
            if (!updated) {
                res.status(404).json({ error: "Company not found" });
                return;
            }
            res.json(updated.toJSON());
        } catch (error) {
            console.error("[SettingsController.updateCompanySettings]", error);
            res.status(500).json({ error: "Failed to update company settings" });
        }
    };

    public updateCookies = async (req: ManagerRequest, res: Response): Promise<void> => {
        try {
            const rawCookies = req.body?.cookies;
            if (typeof rawCookies !== "string") {
                res.status(400).json({ error: "'cookies' must be a string" });
                return;
            }

            const trimmed = rawCookies.trim();
            if (!trimmed) {
                res.status(400).json({ error: "'cookies' must not be empty" });
                return;
            }

            if (req.userId === undefined || req.companyId === undefined) {
                res.sendStatus(401);
                return;
            }

            const record = await this.repository.updateF2FCookies({
                companyId: req.companyId,
                cookies: trimmed,
                userId: req.userId,
            });
            res.json(this.formatResponse(record));
        } catch (error) {
            console.error("[SettingsController.updateCookies]", error);
            res.status(500).json({ error: "Failed to update Face2Face cookies" });
        }
    };
}
