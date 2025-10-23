/**
 * ShiftRequestController module.
 */
import {Request, Response} from "express";
import {container} from "tsyringe";
import {ShiftRequestService} from "../business/services/ShiftRequestService";
import {ShiftRequestStatus, ShiftRequestType} from "../rename/types";

export class ShiftRequestController {
    private get service(): ShiftRequestService {
        return container.resolve(ShiftRequestService);
    }

    public async getAll(req: Request, res: Response): Promise<void> {
        try {
            const status = this.parseStatus(req.query.status);
            const chatterId = this.parseNumber(req.query.chatterId, "chatterId");
            const includeResolved = this.parseBoolean(req.query.includeResolved);
            const requests = await this.service.getAll({
                status,
                chatterId,
                includeResolved,
            });
            res.json(requests.map(r => r.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(400).send(err instanceof Error ? err.message : "Error fetching shift requests");
        }
    }

    public async create(req: Request, res: Response): Promise<void> {
        try {
            const {shiftId, chatterId, type, note} = req.body ?? {};

            const shiftIdNumber = this.toNumber(shiftId);
            if (shiftIdNumber === undefined) {
                res.status(400).send("shiftId is required and must be a number");
                return;
            }

            const chatterIdNumber = this.toNumber(chatterId);
            if (chatterIdNumber === undefined) {
                res.status(400).send("chatterId is required and must be a number");
                return;
            }

            if (!this.isValidType(type)) {
                res.status(400).send("type is required and must be 'cancel' or 'trade'");
                return;
            }

            const request = await this.service.create({
                shiftId: shiftIdNumber,
                chatterId: chatterIdNumber,
                type,
                note: typeof note === "string" && note.trim().length ? note : null,
            });
            res.status(201).json(request.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating shift request");
        }
    }

    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            if (Number.isNaN(id)) {
                res.status(400).send("Invalid id");
                return;
            }

            const {status, managerNote} = req.body ?? {};
            if (!this.isValidStatus(status)) {
                res.status(400).send("status is required and must be a valid shift request status");
                return;
            }

            let resolvedAtUpdate: Date | null | undefined;
            if (status === "pending") {
                resolvedAtUpdate = null;
            } else if (status === "approved" || status === "declined" || status === "cancelled" || status === "resolved") {
                resolvedAtUpdate = new Date();
            }

            const update = await this.service.update(id, {
                status,
                managerNote: managerNote === undefined ? undefined : (managerNote ?? null),
                resolvedAt: resolvedAtUpdate,
            });

            if (!update) {
                res.status(404).send("Shift request not found");
                return;
            }

            res.json(update.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating shift request");
        }
    }

    private parseStatus(value: unknown): ShiftRequestStatus | undefined {
        if (value === undefined) return undefined;
        if (typeof value !== "string") {
            throw new Error("Invalid status");
        }
        if (!this.isValidStatus(value)) {
            throw new Error("Invalid status");
        }
        return value;
    }

    private parseNumber(value: unknown, field: string): number | undefined {
        if (value === undefined || value === "" || value === null) return undefined;
        const parsed = this.toNumber(value);
        if (parsed === undefined) {
            throw new Error(`Invalid ${field}`);
        }
        return parsed;
    }

    private parseBoolean(value: unknown): boolean | undefined {
        if (value === undefined) return undefined;
        if (typeof value === "string") {
            if (value.toLowerCase() === "true") return true;
            if (value.toLowerCase() === "false") return false;
        }
        if (typeof value === "boolean") {
            return value;
        }
        throw new Error("Invalid boolean");
    }

    private isValidType(value: unknown): value is ShiftRequestType {
        return value === "cancel" || value === "trade";
    }

    private isValidStatus(value: unknown): value is ShiftRequestStatus {
        return value === "pending" || value === "approved" || value === "declined" || value === "cancelled" || value === "resolved";
    }

    private toNumber(value: unknown): number | undefined {
        if (value === undefined || value === null || value === "") {
            return undefined;
        }
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
            return undefined;
        }
        return parsed;
    }
}
