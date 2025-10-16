import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { SettingsController } from "../../controllers/SettingsController";
import { F2FCookieSettingRecord } from "../../data/models/F2FCookieSetting";

const mockRepository = () => ({
    getF2FCookies: jest.fn<Promise<F2FCookieSettingRecord | null>, []>(),
    updateF2FCookies: jest.fn<Promise<F2FCookieSettingRecord>, [{ cookies: string; userId: any }]>()
});

const mockUserRepository = () => ({
    findById: jest.fn(),
});

describe("SettingsController", () => {
    let repository: ReturnType<typeof mockRepository>;
    let userRepository: ReturnType<typeof mockUserRepository>;
    let controller: SettingsController;

    beforeEach(() => {
        process.env.F2F_COOKIE_SECRET = "test-secret";
        repository = mockRepository();
        userRepository = mockUserRepository();
        controller = new SettingsController(repository as any, userRepository as any);
    });

    const createResponse = () => {
        const res: any = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.sendStatus = jest.fn().mockReturnValue(res);
        return res;
    };

    it("returns an empty payload when no cookie row exists", async () => {
        const req: any = { userId: BigInt(1) };
        const res = createResponse();
        const next = jest.fn();

        userRepository.findById.mockResolvedValue({ id: 1, role: "manager", fullName: "Manager" });
        repository.getF2FCookies.mockResolvedValue(null);

        await controller.ensureManager(req, res, next);
        expect(next).toHaveBeenCalled();

        await controller.getCookies(req, res);
        expect(res.json).toHaveBeenCalledWith({ cookies: "", updatedAt: null, updatedBy: null });
    });

    it("stores cookies and returns metadata", async () => {
        const req: any = { userId: BigInt(5), body: { cookies: "  session=abc; path=/  " } };
        const res = createResponse();
        const next = jest.fn();
        const updatedAt = new Date("2024-12-01T10:15:30.000Z");

        userRepository.findById.mockResolvedValue({ id: 5, role: "manager", fullName: "Boss" });
        repository.updateF2FCookies.mockResolvedValue({
            id: "ck123",
            cookies: "session=abc; path=/",
            updatedAt,
            updatedById: "5",
            updatedByName: "Boss",
        });

        await controller.ensureManager(req, res, next);
        expect(next).toHaveBeenCalled();

        await controller.updateCookies(req, res);
        expect(repository.updateF2FCookies).toHaveBeenCalledWith({ cookies: "session=abc; path=/", userId: BigInt(5) });
        expect(res.json).toHaveBeenCalledWith({
            cookies: "session=abc; path=/",
            updatedAt: updatedAt.toISOString(),
            updatedBy: { id: "5", name: "Boss" },
        });
    });

    it("rejects non-manager users with 403", async () => {
        const req: any = { userId: BigInt(2) };
        const res = createResponse();
        const next = jest.fn();

        userRepository.findById.mockResolvedValue({ id: 2, role: "chatter", fullName: "Chatter" });

        await controller.ensureManager(req, res, next);
        expect(res.sendStatus).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
        expect(repository.getF2FCookies).not.toHaveBeenCalled();
    });
});
