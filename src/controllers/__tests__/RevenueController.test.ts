import "reflect-metadata";
import {describe, it, expect, jest, beforeEach, afterEach} from "@jest/globals";
import {RevenueController} from "../RevenueController";
import {container} from "tsyringe";
import {RevenueService} from "../../business/services/RevenueService";
import {CompanyService} from "../../business/services/CompanyService";

describe("RevenueController", () => {
    let controller: RevenueController;
    const mockService: any = {
        getEarnings: jest.fn(),
        getStats: jest.fn(),
    };
    const mockCompanyService: any = {
        getById: jest.fn(),
    };
    let resolveSpy: any;

    beforeEach(() => {
        controller = new RevenueController();
        mockService.getEarnings.mockReset();
        mockService.getEarnings.mockResolvedValue([]);
        mockService.getStats.mockReset();
        mockService.getStats.mockResolvedValue({daily: 0, weekly: 0, monthly: 0});
        mockCompanyService.getById.mockReset();
        resolveSpy = jest.spyOn(container, "resolve").mockImplementation((token: any) => {
            if (token === RevenueService) {
                return mockService as any;
            }
            if (token === CompanyService) {
                return mockCompanyService as any;
            }
            throw new Error(`Unexpected token: ${token}`);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("expands date-only parameters to full-day range", async () => {
        const req = {
            query: {
                from: "2023-09-01",
                to: "2023-09-30",
            },
        } as any;
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        } as any;

        await controller.getEarnings(req, res);

        expect(resolveSpy).toHaveBeenCalled();
        expect(mockService.getEarnings).toHaveBeenCalledWith({
            from: new Date("2023-09-01T00:00:00.000Z"),
            to: new Date("2023-09-30T23:59:59.999Z"),
        });
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it("keeps explicit timestamps intact", async () => {
        const req = {
            query: {
                from: "2023-09-01T10:00:00.000Z",
                to: "2023-09-30T15:30:00.000Z",
            },
        } as any;
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        } as any;

        await controller.getEarnings(req, res);

        expect(mockService.getEarnings).toHaveBeenCalledWith({
            from: new Date("2023-09-01T10:00:00.000Z"),
            to: new Date("2023-09-30T15:30:00.000Z"),
        });
    });

    it("derives timezone from company settings for stats", async () => {
        const req = {
            query: {},
            companyId: 42,
        } as any;
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        } as any;

        mockCompanyService.getById.mockResolvedValue({ timezone: "America/New_York" });
        mockService.getStats.mockResolvedValue({ daily: 10, weekly: 20, monthly: 30 });

        await controller.getStats(req, res);

        expect(mockCompanyService.getById).toHaveBeenCalledWith(42);
        expect(mockService.getStats).toHaveBeenCalledWith({ from: undefined, to: undefined, timezone: "America/New_York" });
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ daily: 10, weekly: 20, monthly: 30 });
    });

    it("uses timezone from company over JWT when available", async () => {
        const req = {
            query: {},
            companyId: 99,
            companyTimezone: "Asia/Tokyo",
        } as any;
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        } as any;

        mockCompanyService.getById.mockResolvedValue({ timezone: "Europe/London" });
        mockService.getStats.mockResolvedValue({ daily: 1, weekly: 2, monthly: 3 });

        await controller.getStats(req, res);

        expect(mockCompanyService.getById).toHaveBeenCalledWith(99);
        expect(mockService.getStats).toHaveBeenCalledWith({ from: undefined, to: undefined, timezone: "Europe/London" });
        expect(res.json).toHaveBeenCalledWith({ daily: 1, weekly: 2, monthly: 3 });
    });
});
