import { Router, Response, NextFunction } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { F2FCookieSettingRepository } from "../data/repositories/F2FCookieSettingRepository";
import { UserRepository } from "../data/repositories/UserRepository";
import { Role } from "../rename/types";

interface SettingsRouterDependencies {
    repository: F2FCookieSettingRepository;
    userRepository: UserRepository;
    authenticate: typeof authenticateToken;
}

interface ManagerRequest extends AuthenticatedRequest {
    currentUser?: { id: number; role: Role; fullName: string };
}

type HandlerDeps = Pick<SettingsRouterDependencies, "repository" | "userRepository">;

type GetCookiesResponse = {
    cookies: string;
    updatedAt: string | null;
    updatedBy: { id: string; name: string | null } | null;
};

export function buildSettingsHandlers({ repository, userRepository }: HandlerDeps) {
    const ensureManager = async (req: ManagerRequest, res: Response, next: NextFunction) => {
        try {
            if (req.userId === undefined) {
                res.sendStatus(401);
                return;
            }

            const user = await userRepository.findById(Number(req.userId));
            if (!user || user.role !== "manager") {
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
            console.error("[settings.ensureManager]", error);
            res.status(500).json({ error: "Failed to authorize request" });
        }
    };

    const formatResponse = (record: Awaited<ReturnType<typeof repository.getF2FCookies>>): GetCookiesResponse => {
        if (!record) {
            return {
                cookies: "",
                updatedAt: null,
                updatedBy: null,
            };
        }

        const updatedAt = record.updatedById ? record.updatedAt?.toISOString() ?? null : null;
        const updatedBy = record.updatedById
            ? { id: record.updatedById, name: record.updatedByName ?? null }
            : null;

        return {
            cookies: record.cookies,
            updatedAt,
            updatedBy,
        };
    };

    const getCookies = async (_req: ManagerRequest, res: Response) => {
        try {
            const record = await repository.getF2FCookies();
            res.json(formatResponse(record));
        } catch (error) {
            console.error("[settings.getF2FCookies]", error);
            res.status(500).json({ error: "Failed to load Face2Face cookies" });
        }
    };

    const updateCookies = async (req: ManagerRequest, res: Response) => {
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

            if (req.userId === undefined) {
                res.sendStatus(401);
                return;
            }

            const record = await repository.updateF2FCookies({ cookies: trimmed, userId: req.userId });
            const response = formatResponse(record);
            res.json(response);
        } catch (error) {
            console.error("[settings.updateF2FCookies]", error);
            res.status(500).json({ error: "Failed to update Face2Face cookies" });
        }
    };

    return { ensureManager, getCookies, updateCookies };
}

export function createSettingsRouter(deps?: Partial<SettingsRouterDependencies>) {
    const repository = deps?.repository ?? new F2FCookieSettingRepository();
    const userRepository = deps?.userRepository ?? new UserRepository();
    const authenticate = deps?.authenticate ?? authenticateToken;

    const { ensureManager, getCookies, updateCookies } = buildSettingsHandlers({ repository, userRepository });

    const router = Router();
    router.get("/f2f-cookies", authenticate, ensureManager, getCookies);
    router.put("/f2f-cookies", authenticate, ensureManager, updateCookies);
    return router;
}

export default createSettingsRouter();
