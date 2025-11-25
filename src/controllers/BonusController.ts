/**
 * BonusController module.
 */
import { Request, Response } from "express";
import { container } from "tsyringe";
import { BonusService } from "../business/services/BonusService";
import { BonusValidationError } from "../business/bonus/BonusErrors";

function parseNumber(value: unknown, field: string, required = false): number | undefined {
    if (Array.isArray(value)) {
        return parseNumber(value[0], field, required);
    }
    if (value === undefined || value === null || value === "") {
        if (required) {
            throw new BonusValidationError(`${field} is required`);
        }
        return undefined;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        throw new BonusValidationError(`Invalid ${field}`);
    }
    return parsed;
}

function parseBoolean(value: unknown, defaultValue: boolean | undefined = undefined): boolean | undefined {
    if (value === undefined) {
        return defaultValue;
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
    }
    throw new BonusValidationError("Invalid boolean value");
}

export class BonusController {
    private get service(): BonusService {
        return container.resolve(BonusService);
    }

    public async getRules(req: Request, res: Response): Promise<void> {
        try {
            const companyId = parseNumber((req as any).companyId, "companyId")!;
            const active = parseBoolean(req.query.active);
            const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;

            const rules = await this.service.listRules({
                companyId,
                isActive: active,
                scope: scope === "worker" || scope === "company" ? (scope as any) : undefined,
            });
            res.json(rules.map(rule => rule.toJSON()));
        } catch (err) {
            this.handleError(res, err);
        }
    }

    public async createRule(req: Request, res: Response): Promise<void> {
        try {
            const payload = req.body ?? {};
            // Support both isActive and active (alias)
            const isActive = parseBoolean(payload.isActive ?? payload.active);
            if (isActive === undefined) {
                throw new BonusValidationError("isActive is required");
            }
            const scopeRaw = "worker";
            // Support window object { type, durationSeconds } as well as flat fields
            const windowTypeRaw = typeof payload.windowType === "string"
                ? payload.windowType
                : (typeof payload.window?.type === "string" ? payload.window.type : "calendar_day");
            const ruleTypeRaw = "threshold_payout";
            // Accept both ruleConfig and config, and map currencyFilters -> currencies
            const providedRuleConfig: any = (payload.ruleConfig ?? payload.config ?? {});
            if (providedRuleConfig && typeof providedRuleConfig === "object") {
                if (providedRuleConfig.currencies === undefined && Array.isArray(providedRuleConfig.currencyFilters)) {
                    providedRuleConfig.currencies = providedRuleConfig.currencyFilters;
                }
            }
            const rule = await this.service.createRule({
                companyId: Number(payload.companyId),
                name: String(payload.name ?? ""),
                isActive,
                priority: Number(payload.priority ?? 0),
                scope: scopeRaw as any,
                windowType: windowTypeRaw as any,
                windowSeconds: null,
                ruleType: ruleTypeRaw as any,
                ruleConfig: providedRuleConfig,
            });
            res.status(201).json(rule.toJSON());
        } catch (err) {
            this.handleError(res, err);
        }
    }

    public async updateRule(req: Request, res: Response): Promise<void> {
        try {
            const id = parseNumber(req.params.ruleId, "ruleId", true)!;
            const payload = req.body ?? {};
            // Accept alias 'active' for isActive
            const isActive = payload.isActive !== undefined
                ? parseBoolean(payload.isActive)
                : (payload.active !== undefined ? parseBoolean(payload.active) : undefined);
            if (payload.isActive !== undefined && isActive === undefined) {
                throw new BonusValidationError("Invalid isActive value");
            }
            const priority = payload.priority !== undefined ? parseNumber(payload.priority, "priority") : undefined;
            // Support window object { type, durationSeconds }
            const windowSeconds = payload.windowSeconds !== undefined
                ? parseNumber(payload.windowSeconds, "windowSeconds")
                : (payload.window?.durationSeconds !== undefined ? parseNumber(payload.window.durationSeconds, "window.durationSeconds") : undefined);
            const scope = typeof payload.scope === "string" ? payload.scope : undefined;
            if (scope && scope !== "worker" && scope !== "company") {
                throw new BonusValidationError("scope must be 'worker' or 'company'");
            }
            const windowType = typeof payload.windowType === "string"
                ? payload.windowType
                : (typeof payload.window?.type === "string" ? payload.window.type : undefined);
            if (windowType && !["calendar_day", "calendar_month"].includes(windowType)) {
                throw new BonusValidationError("Unsupported windowType");
            }
            const ruleType = typeof payload.ruleType === "string" ? payload.ruleType : undefined;
            if (ruleType && ruleType !== "threshold_payout") {
                throw new BonusValidationError("Unsupported ruleType");
            }
            // Accept 'config' alias and map currencyFilters -> currencies
            let ruleConfig = payload.ruleConfig ?? payload.config;
            if (ruleConfig && typeof ruleConfig === "object") {
                if ((ruleConfig as any).currencies === undefined && Array.isArray((ruleConfig as any).currencyFilters)) {
                    (ruleConfig as any).currencies = (ruleConfig as any).currencyFilters;
                }
            }
            const updated = await this.service.updateRule(id, {
                name: payload.name,
                isActive,
                priority,
                scope: scope as any,
                windowType: windowType as any,
                windowSeconds: null,
                ruleType: (ruleType ?? "threshold_payout") as any,
                ruleConfig,
            });
            if (!updated) {
                res.status(404).send("Rule not found");
                return;
            }
            res.json(updated.toJSON());
        } catch (err) {
            this.handleError(res, err);
        }
    }

    public async previewRule(req: Request, res: Response): Promise<void> {
        try {
            const ruleId = parseNumber(req.params.ruleId, "ruleId", true)!;
            const companyId = parseNumber((req as any).companyId, "companyId")!;
            const workerId = parseNumber(req.body?.workerId ?? req.query.workerId, "workerId");
            const asOfRaw = req.body?.asOf ?? req.query.asOf;
            const asOf = asOfRaw ? new Date(asOfRaw) : new Date();
            if (Number.isNaN(asOf.getTime())) {
                throw new BonusValidationError("Invalid asOf timestamp");
            }

            const snapshot = await this.service.previewRule(ruleId, {
                companyId,
                workerId: workerId ?? null,
                asOf,
            });
            res.json(snapshot);
        } catch (err) {
            this.handleError(res, err);
        }
    }

    public async run(req: Request, res: Response): Promise<void> {
        try {
            const companyId = parseNumber((req as any).companyId, "companyId")!;
            const workerId = parseNumber(req.body?.workerId ?? req.query.workerId, "workerId");
            const ruleId = parseNumber(req.body?.ruleId ?? req.query.ruleId, "ruleId");
            const asOfRaw = req.body?.asOf ?? req.query.asOf;
            const asOf = asOfRaw ? new Date(asOfRaw) : new Date();
            if (Number.isNaN(asOf.getTime())) {
                throw new BonusValidationError("Invalid asOf timestamp");
            }

            const snapshots = await this.service.runRules({
                companyId,
                workerId: workerId ?? null,
                ruleId,
                asOf,
            });
            res.json({
                evaluations: snapshots,
            });
        } catch (err) {
            this.handleError(res, err);
        }
    }

    public async getAwards(req: Request, res: Response): Promise<void> {
        try {
            const companyId = parseNumber((req as any).companyId, "companyId")!;
            const workerId = parseNumber(req.query.workerId, "workerId");
            const fromRaw = req.query.from;
            const toRaw = req.query.to;
            const from = fromRaw ? new Date(String(fromRaw)) : undefined;
            const to = toRaw ? new Date(String(toRaw)) : undefined;
            if (from && Number.isNaN(from.getTime())) {
                throw new BonusValidationError("Invalid from parameter");
            }
            if (to && Number.isNaN(to.getTime())) {
                throw new BonusValidationError("Invalid to parameter");
            }
            const limit = parseNumber(req.query.limit, "limit");
            const page = parseNumber(req.query.page, "page");
            const offsetParam = parseNumber(req.query.offset, "offset");
            const offset = offsetParam != null
                ? offsetParam
                : (limit != null && page != null ? limit * Math.max(page - 1, 0) : undefined);

            const result = await this.service.listAwards({
                companyId,
                workerId,
                from,
                to,
                limit: limit ?? undefined,
                offset,
            });
            res.json({
                data: result.awards.map(a => a.toJSON()),
                meta: {
                    total: result.totals.count,
                    totals: {
                        bonusAmountCents: result.totals.totalCents,
                        totalCents: result.totals.totalCents, // alias for clients expecting totalCents
                    },
                },
            });
        } catch (err) {
            this.handleError(res, err);
        }
    }

    public async getProgress(req: Request, res: Response): Promise<void> {
        try {
            const companyId = parseNumber((req as any).companyId, "companyId")!;
            const workerId = parseNumber(req.query.workerId, "workerId");
            const progress = await this.service.listProgress({ companyId, workerId: workerId ?? undefined });
            res.json(progress.map(p => p.toJSON()));
        } catch (err) {
            this.handleError(res, err);
        }
    }

    private handleError(res: Response, err: unknown): void {
        if (err instanceof BonusValidationError) {
            res.status(400).json({ message: err.message });
            return;
        }
        console.error("[bonus] controller error", err);
        res.status(500).json({ message: "Internal server error" });
    }
}
