import {describe, it, expect, beforeEach, afterEach, jest} from "@jest/globals";
import {container} from "tsyringe";
import {ShiftRequestController} from "../ShiftRequestController";

describe("ShiftRequestController.update", () => {
    let controller: ShiftRequestController;
    let resolveSpy: jest.SpyInstance;
    const service = {
        update: jest.fn(),
    };

    const createResponse = () => ({
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
    });

    beforeEach(() => {
        controller = new ShiftRequestController();
        service.update.mockReset();
        service.update.mockResolvedValue({toJSON: () => ({})});
        resolveSpy = jest.spyOn(container, "resolve").mockReturnValue(service as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("trims manager notes before updating", async () => {
        const req = {
            params: {id: "5"},
            body: {status: "approved", managerNote: "  Reviewed  "},
        } as any;
        const res = createResponse();

        await controller.update(req, res);

        expect(resolveSpy).toHaveBeenCalled();
        expect(service.update).toHaveBeenCalledWith(5, expect.objectContaining({
            status: "approved",
            managerNote: "Reviewed",
            resolvedAt: expect.any(Date),
        }));
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({});
    });

    it("stores cleared manager notes as null", async () => {
        const req = {
            params: {id: "5"},
            body: {status: "approved", managerNote: "   "},
        } as any;
        const res = createResponse();

        await controller.update(req, res);

        expect(service.update).toHaveBeenCalledWith(5, expect.objectContaining({
            managerNote: null,
        }));
    });

    it("allows status updates without modifying the manager note", async () => {
        const req = {
            params: {id: "7"},
            body: {status: "declined"},
        } as any;
        const res = createResponse();

        await controller.update(req, res);

        expect(service.update).toHaveBeenCalledWith(7, expect.objectContaining({
            status: "declined",
            managerNote: undefined,
        }));
    });
});
