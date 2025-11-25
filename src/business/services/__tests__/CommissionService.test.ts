import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { CommissionService } from "../CommissionService";
import { BonusService } from "../BonusService";
import { ICommissionRepository } from "../../../data/interfaces/ICommissionRepository";
import { IEmployeeEarningRepository } from "../../../data/interfaces/IEmployeeEarningRepository";
import { IChatterRepository } from "../../../data/interfaces/IChatterRepository";
import { IShiftRepository } from "../../../data/interfaces/IShiftRepository";
import { ShiftModel } from "../../models/ShiftModel";

const createService = () => {
    const commissionRepo = {
        findByShiftId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    } as unknown as jest.Mocked<ICommissionRepository>;

    const earningRepo = {
        findAll: jest.fn(),
        update: jest.fn(),
    } as unknown as jest.Mocked<IEmployeeEarningRepository>;

    const chatterRepo = {
        findById: jest.fn(),
    } as unknown as jest.Mocked<IChatterRepository>;

    const shiftRepo = {
        findById: jest.fn(),
        findAll: jest.fn(),
        findShiftForChatterAt: jest.fn(),
    } as unknown as jest.Mocked<IShiftRepository>;

    const bonusService = {
        runShiftScopedRules: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<BonusService>;

    const service = new CommissionService(commissionRepo, earningRepo, chatterRepo, shiftRepo, bonusService);

    return { service, commissionRepo, earningRepo, chatterRepo, shiftRepo, bonusService };
};

const createShift = (overrides: Partial<ShiftModel> = {}): ShiftModel => ({
    id: 101,
    chatterId: 303,
    status: "completed",
    date: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
} as unknown as ShiftModel);

const createEarning = (overrides: Partial<any> = {}) => ({
    id: overrides.id ?? "earning-1",
    chatterId: overrides.chatterId ?? null,
    modelId: overrides.modelId ?? 1,
    shiftId: overrides.shiftId ?? null,
    date: overrides.date ?? new Date("2024-01-01T00:00:00Z"),
    amount: overrides.amount ?? 25,
    description: overrides.description ?? null,
    type: overrides.type ?? "paypermessage",
});

describe("CommissionService backfill", () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("backfills eligible earnings with missing chatter/shift ids when creating commissions", async () => {
        const { service, commissionRepo, earningRepo, chatterRepo } = createService();
        const shift = createShift();
        const eligibleMissing = createEarning({ id: "missing-both", chatterId: null, shiftId: null, type: "paypermessage" });
        const eligibleMissingShift = createEarning({ id: "missing-shift", chatterId: 404, shiftId: null, type: "tip" });
        const alreadyAssigned = createEarning({ id: "assigned", chatterId: shift.chatterId, shiftId: shift.id, type: "paypermessage" });
        const nonEligible = createEarning({ id: "non-eligible", type: "sale" });

        commissionRepo.findByShiftId.mockResolvedValueOnce(null as any);
        commissionRepo.create.mockResolvedValueOnce({} as any);
        earningRepo.findAll.mockResolvedValueOnce([eligibleMissing, eligibleMissingShift, alreadyAssigned, nonEligible]);
        earningRepo.update.mockResolvedValue({} as any);
        chatterRepo.findById.mockResolvedValue({ show: false, platformFee: 0, commissionRate: 10 } as any);

        await service.ensureCommissionForShift(shift);

        expect(earningRepo.update).toHaveBeenCalledTimes(2);
        expect(earningRepo.update).toHaveBeenCalledWith("missing-both", { chatterId: shift.chatterId, shiftId: shift.id });
        expect(earningRepo.update).toHaveBeenCalledWith("missing-shift", { chatterId: 404, shiftId: shift.id });
        expect(commissionRepo.create).toHaveBeenCalledTimes(1);
    });

    it("skips backfilling when eligible earnings are already linked", async () => {
        const { service, commissionRepo, earningRepo, chatterRepo } = createService();
        const shift = createShift();
        const linked = createEarning({ id: "linked", chatterId: shift.chatterId, shiftId: shift.id, type: "paypermessage" });
        const otherType = createEarning({ id: "other", chatterId: null, shiftId: null, type: "bonus" });

        commissionRepo.findByShiftId.mockResolvedValueOnce(null as any);
        commissionRepo.create.mockResolvedValueOnce({} as any);
        earningRepo.findAll.mockResolvedValueOnce([linked, otherType]);
        earningRepo.update.mockResolvedValue({} as any);
        chatterRepo.findById.mockResolvedValue({ show: false, platformFee: 0, commissionRate: 10 } as any);

        await service.ensureCommissionForShift(shift);

        expect(earningRepo.update).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("CommissionService.backfillShiftEarnings: all 1 pay-per-message/tip earnings already linked"),
        );
    });

    it("backfills during commission recalculation without altering linked earnings", async () => {
        const { service, commissionRepo, earningRepo, chatterRepo } = createService();
        const shift = createShift();
        const eligibleMissing = createEarning({ id: "eligible", chatterId: null, shiftId: null, type: "tip", amount: 50 });
        const linked = createEarning({ id: "linked", chatterId: shift.chatterId, shiftId: shift.id, type: "paypermessage", amount: 25 });

        commissionRepo.findByShiftId.mockResolvedValueOnce({
            id: 555,
            chatterId: shift.chatterId,
            shiftId: shift.id,
            commissionDate: shift.date,
            earnings: 0,
            commissionRate: 10,
            commission: 0,
            bonus: 0,
            totalPayout: 0,
            status: "pending",
        } as any);
        commissionRepo.update.mockResolvedValueOnce({} as any);
        earningRepo.findAll.mockResolvedValueOnce([eligibleMissing, linked]);
        earningRepo.update.mockResolvedValue({} as any);
        chatterRepo.findById.mockResolvedValue({ show: false, platformFee: 0, commissionRate: 10 } as any);

        await service.recalculateCommissionForShift(shift);

        expect(earningRepo.update).toHaveBeenCalledTimes(1);
        expect(earningRepo.update).toHaveBeenCalledWith("eligible", { chatterId: shift.chatterId, shiftId: shift.id });
        expect(commissionRepo.update).toHaveBeenCalledTimes(1);
    });
});
