import {describe, it, expect, jest, beforeEach, afterEach} from "@jest/globals";
import {EmployeeEarningController} from "../EmployeeEarningController";
import {container} from "tsyringe";

describe("EmployeeEarningController.sync", () => {
    let controller: EmployeeEarningController;
    const mockService = {
        syncWithChatters: jest.fn(),
    };
    let resolveSpy: jest.SpyInstance;

    beforeEach(() => {
        controller = new EmployeeEarningController();
        mockService.syncWithChatters.mockReset();
        mockService.syncWithChatters.mockResolvedValue({created: 0, updated: 0});
        resolveSpy = jest.spyOn(container, "resolve").mockReturnValue(mockService as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("expands date-only values to full-day range", async () => {
        const req = {
            query: {
                from: "2023-09-01",
                to: "2023-09-30",
            },
            body: {},
        } as any;
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        } as any;

        await controller.sync(req, res);

        expect(resolveSpy).toHaveBeenCalled();
        expect(mockService.syncWithChatters).toHaveBeenCalledWith(
            new Date("2023-09-01T00:00:00.000Z"),
            new Date("2023-09-30T23:59:59.999Z"),
        );
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({created: 0, updated: 0});
    });

    it("respects explicit timestamps provided in the body", async () => {
        const req = {
            query: {},
            body: {
                from: "2023-09-28T12:30:00.000Z",
                to: "2023-09-30T06:45:00.000Z",
            },
        } as any;
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        } as any;

        await controller.sync(req, res);

        expect(mockService.syncWithChatters).toHaveBeenCalled();
        const [fromArg, toArg] = mockService.syncWithChatters.mock.calls[0];
        expect(fromArg.toISOString()).toBe("2023-09-28T12:30:00.000Z");
        expect(toArg.toISOString()).toBe("2023-09-30T06:45:00.000Z");
    });

    it("returns 400 when dates are invalid", async () => {
        const req = {
            query: {
                from: "2023-09-01",
                to: "not-a-date",
            },
            body: {},
        } as any;
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        } as any;

        await controller.sync(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith("Invalid 'from' or 'to' date");
        expect(mockService.syncWithChatters).not.toHaveBeenCalled();
    });
});

