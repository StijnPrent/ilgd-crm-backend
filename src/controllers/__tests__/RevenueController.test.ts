import {describe, it, expect, jest, beforeEach, afterEach} from "@jest/globals";
import {RevenueController} from "../RevenueController";
import {container} from "tsyringe";

describe("RevenueController", () => {
    let controller: RevenueController;
    const mockService = {
        getEarnings: jest.fn(),
        getStats: jest.fn(),
    };
    let resolveSpy: jest.SpyInstance;

    beforeEach(() => {
        controller = new RevenueController();
        mockService.getEarnings.mockReset();
        mockService.getEarnings.mockResolvedValue([]);
        mockService.getStats.mockReset();
        mockService.getStats.mockResolvedValue({daily: 0, weekly: 0, monthly: 0});
        resolveSpy = jest.spyOn(container, "resolve").mockReturnValue(mockService as any);
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
});
