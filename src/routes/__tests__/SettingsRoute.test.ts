import "reflect-metadata";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { SettingsController } from "../../controllers/SettingsController";

const mockRepository = () => ({
    getF2FCookies: jest.fn(),
    updateF2FCookies: jest.fn(),
});

const mockUserRepository = () => ({
    findById: jest.fn(),
});

const mockModelRepository = () => ({
    findByIds: jest.fn(),
});

describe("SettingsController", () => {
    let repository: any;
    let userRepository: any;
    let controller: SettingsController;
    let modelRepository: any;

    beforeEach(() => {
        process.env.F2F_COOKIE_SECRET = "test-secret";
        repository = mockRepository();
        userRepository = mockUserRepository();
        modelRepository = mockModelRepository();
        controller = new SettingsController(repository as any, userRepository as any, {} as any, modelRepository as any);
    });

    const createResponse = () => {
        const res: any = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.sendStatus = jest.fn().mockReturnValue(res);
        return res;
    };

    it("returns an empty payload when no cookie row exists", async () => {
        const req: any = { userId: BigInt(1), companyId: 1 };
        const res = createResponse();
        const next = jest.fn();

        userRepository.findById.mockResolvedValue({ id: 1, role: "manager", fullName: "Manager", companyId: 1 });
        repository.getF2FCookies.mockResolvedValue(null);

        await controller.ensureManager(req, res, next);
        expect(next).toHaveBeenCalled();

        await controller.getCookies(req, res);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it("stores cookies and returns metadata", async () => {
        const req: any = { userId: BigInt(5), companyId: 1, body: { cookies: "  session=abc; path=/  " } };
        const res = createResponse();
        const next = jest.fn();
        const updatedAt = new Date("2024-12-01T10:15:30.000Z");

        userRepository.findById.mockResolvedValue({ id: 5, role: "manager", fullName: "Boss", companyId: 1 });
        repository.updateF2FCookies.mockResolvedValue({
            id: "ck123",
            cookies: "session=abc; path=/",
            entries: [{ id: "ck123", type: "creator", cookies: "session=abc; path=/", label: null, updatedAt }],
            updatedAt,
            updatedById: "5",
            updatedByName: "Boss",
        });
        modelRepository.findByIds.mockResolvedValue([]);

        await controller.ensureManager(req, res, next);
        expect(next).toHaveBeenCalled();

        await controller.updateCookies(req, res);
        expect(repository.updateF2FCookies).toHaveBeenCalledWith({
            companyId: 1,
            entries: [{ type: "creator", cookies: "session=abc; path=/" }],
            userId: BigInt(5)
        });
        expect(res.json).toHaveBeenCalledWith([
            {
                id: "ck123",
                cookies: "session=abc; path=/",
                name: null,
                model: null,
                updatedAt: updatedAt.toISOString(),
                updatedBy: { id: "5", name: "Boss" },
            }
        ]);
    });

    it("rejects non-manager users with 403", async () => {
        const req: any = { userId: BigInt(2) };
        const res = createResponse();
        const next = jest.fn();

        userRepository.findById.mockResolvedValue({ id: 2, role: "chatter", fullName: "Chatter", companyId: 1 });

        await controller.ensureManager(req, res, next);
        expect(res.sendStatus).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
        expect(repository.getF2FCookies).not.toHaveBeenCalled();
    });
});
