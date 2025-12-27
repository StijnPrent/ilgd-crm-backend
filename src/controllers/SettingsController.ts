import { Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { AuthenticatedRequest } from "../middleware/auth";
import { IF2FCookieSettingRepository } from "../data/interfaces/IF2FCookieSettingRepository";
import { IUserRepository } from "../data/interfaces/IUserRepository";
import { CompanyUpdateInput } from "../data/interfaces/ICompanyRepository";
import { Role } from "../rename/types";
import { CompanyService } from "../business/services/CompanyService";
import { F2FCookieEntry } from "../data/models/F2FCookieSetting";
import { IModelRepository } from "../data/interfaces/IModelRepository";
import { IEarningTypeRepository } from "../data/interfaces/IEarningTypeRepository";
import { F2FTransactionSyncService } from "../business/services/F2FTransactionSyncService";

interface ManagerRequest extends AuthenticatedRequest {
    currentUser?: { id: number; role: Role; fullName: string };
}

type CookiesResponseItem = {
    id: string;
    cookies: string;
    name: string | null;
    model: { id: number; name: string | null } | null;
    allowedEarningTypeIds?: number[];
    allowedEarningTypes?: string[];
    allowedUserRelationships?: ("fan" | "follower")[];
    updatedAt: string | null;
    updatedBy: { id: string; name: string | null } | null;
};

@injectable()
export class SettingsController {
    constructor(
        @inject("IF2FCookieSettingRepository") private repository: IF2FCookieSettingRepository,
        @inject("IUserRepository") private userRepository: IUserRepository,
        @inject("CompanyService") private companyService: CompanyService,
        @inject("IModelRepository") private modelRepository: IModelRepository,
        @inject("IEarningTypeRepository") private earningTypeRepository: IEarningTypeRepository,
        private txnSync: F2FTransactionSyncService,
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

    private async formatResponse(record: Awaited<ReturnType<IF2FCookieSettingRepository["getF2FCookies"]>>): Promise<CookiesResponseItem[]> {
        if (!record) {
            return [];
        }

        const entries = record.entries ?? [];
        const modelIds = entries
            .map(e => (typeof e.modelId === "number" ? e.modelId : Number(e.modelId)))
            .filter((id): id is number => Number.isFinite(id));
        const uniqueModelIds = Array.from(new Set(modelIds));
        const models = uniqueModelIds.length
            ? await this.modelRepository.findByIds(uniqueModelIds)
            : [];
        const modelMap = new Map<number, { id: number; name: string | null }>();
        for (const m of models) {
            modelMap.set(m.id, { id: m.id, name: m.displayName ?? m.username ?? null });
        }

        return entries.map(e => {
            const updatedAt = e.updatedAt ? e.updatedAt.toISOString() : record.updatedAt?.toISOString() ?? null;
            const updatedById = e.updatedById ?? record.updatedById ?? null;
            const updatedByName = e.updatedByName ?? record.updatedByName ?? null;
            const modelIdNum = typeof e.modelId === "number" ? e.modelId : Number(e.modelId);
            const model = Number.isFinite(modelIdNum) ? modelMap.get(modelIdNum) ?? null : null;
            return {
                id: e.id ?? record.id,
                cookies: e.cookies,
                name: e.label ?? null,
                model,
                allowedEarningTypeIds: e.allowedEarningTypeIds,
                allowedEarningTypes: e.allowedEarningTypes,
                allowedUserRelationships: e.allowedUserRelationships,
                updatedAt,
                updatedBy: updatedById ? { id: updatedById, name: updatedByName ?? null } : null,
            };
        });
    }

    public getCookies = async (req: ManagerRequest, res: Response): Promise<void> => {
        try {
            if (req.companyId === undefined) {
                res.sendStatus(400);
                return;
            }
            const record = await this.repository.getF2FCookies({ companyId: req.companyId });
            const payload = await this.formatResponse(record);
            res.json(payload);
        } catch (error) {
            console.error("[SettingsController.getCookies]", error);
            res.status(500).json({ error: "Failed to load F2F cookies" });
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

    public getEarningTypes = async (_req: ManagerRequest, res: Response): Promise<void> => {
        try {
            const types = await this.earningTypeRepository.listActive();
            res.json(types);
        } catch (error) {
            console.error("[SettingsController.getEarningTypes]", error);
            res.status(500).json({ error: "Failed to load earning types" });
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
            const rawArray = req.body;
            let payload: { entries: F2FCookieEntry[] } | null = null;

            if (Array.isArray(rawArray)) {
                const normalized = (rawArray as any[]).map(raw => {
                    const modelId = raw?.modelId;
                    const allowedIds = Array.isArray(raw?.allowedEarningTypeIds) ? raw.allowedEarningTypeIds.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)) : undefined;
                    const allowedTypes = Array.isArray(raw?.allowedEarningTypes) ? raw.allowedEarningTypes.map((v: any) => typeof v === "string" ? v.toLowerCase().trim() : "").filter(Boolean) : undefined;
                    const allowedUserRelationships = Array.isArray(raw?.allowedUserRelationships)
                        ? raw.allowedUserRelationships.map((v: any) => typeof v === "string" ? v.toLowerCase().trim() : "").filter((v: string) => v === "fan" || v === "follower")
                        : undefined;
                    return {
                        type: modelId !== null && modelId !== undefined ? "model" : "creator",
                        cookies: typeof raw?.cookies === "string" ? raw.cookies.trim() : "",
                        label: typeof raw?.name === "string" ? raw.name.trim() || undefined : undefined,
                        modelId: typeof modelId === "number" ? modelId : typeof modelId === "string" ? Number(modelId) : undefined,
                        allowedEarningTypeIds: allowedIds && allowedIds.length ? allowedIds : undefined,
                        allowedEarningTypes: allowedTypes && allowedTypes.length ? allowedTypes : undefined,
                        allowedUserRelationships: allowedUserRelationships && allowedUserRelationships.length ? allowedUserRelationships : undefined,
                    } as F2FCookieEntry;
                }).filter(e => !!e.cookies);

                if (!normalized.length) {
                    res.status(400).json({ error: "At least one cookie entry is required" });
                    return;
                }
                payload = { entries: normalized };
            } else {
                const rawCookies = req.body?.cookies;
                const rawEntries = req.body?.entries;
                if (Array.isArray(rawEntries)) {
                    const normalized = (rawEntries as any[]).map(raw => {
                        const entryType: F2FCookieEntry["type"] = raw?.type === "model" ? "model" : "creator";
                        const modelId = raw?.modelId;
                        const allowedIds = Array.isArray(raw?.allowedEarningTypeIds) ? raw.allowedEarningTypeIds.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)) : undefined;
                        const allowedTypes = Array.isArray(raw?.allowedEarningTypes) ? raw.allowedEarningTypes.map((v: any) => typeof v === "string" ? v.toLowerCase().trim() : "").filter(Boolean) : undefined;
                        const allowedUserRelationships = Array.isArray(raw?.allowedUserRelationships)
                            ? raw.allowedUserRelationships.map((v: any) => typeof v === "string" ? v.toLowerCase().trim() : "").filter((v: string) => v === "fan" || v === "follower")
                            : undefined;
                        return {
                            type: entryType,
                            cookies: typeof raw?.cookies === "string" ? raw.cookies.trim() : "",
                            label: typeof raw?.label === "string" ? raw.label.trim() || undefined : typeof raw?.name === "string" ? raw.name.trim() || undefined : undefined,
                            modelUsername: typeof raw?.modelUsername === "string" ? raw.modelUsername.trim() || undefined : undefined,
                            modelId: typeof modelId === "number" ? modelId : typeof modelId === "string" ? Number(modelId) : undefined,
                            allowedEarningTypeIds: allowedIds && allowedIds.length ? allowedIds : undefined,
                            allowedEarningTypes: allowedTypes && allowedTypes.length ? allowedTypes : undefined,
                            allowedUserRelationships: allowedUserRelationships && allowedUserRelationships.length ? allowedUserRelationships : undefined,
                        } as F2FCookieEntry;
                    }).filter(e => !!e.cookies);

                    if (!normalized.length) {
                        res.status(400).json({ error: "At least one cookie entry is required" });
                        return;
                    }
                    payload = { entries: normalized };
                } else {
                    if (typeof rawCookies !== "string") {
                        res.status(400).json({ error: "'cookies' must be a string when 'entries' is not provided" });
                        return;
                    }

                    const trimmed = rawCookies.trim();
                    if (!trimmed) {
                        res.status(400).json({ error: "'cookies' must not be empty" });
                        return;
                    }
                    payload = { entries: [{ type: "creator", cookies: trimmed }] };
                }
            }

            if (req.userId === undefined || req.companyId === undefined) {
                res.sendStatus(401);
                return;
            }

            const record = await this.repository.updateF2FCookies({
                companyId: req.companyId,
                ...payload,
                userId: req.userId,
            });
            // Ensure any in-memory caches reload the latest cookies.
            this.txnSync.invalidateCookieCache();
            const response = await this.formatResponse(record);
            res.json(response);
        } catch (error) {
            console.error("[SettingsController.updateCookies]", error);
            res.status(500).json({ error: "Failed to update F2F cookies" });
        }
    };
}
