import {Request, Response} from "express";
import {container} from "tsyringe";
import {RevenueService} from "../business/services/RevenueService";

export class RevenueController {
    private get service(): RevenueService {
        return container.resolve(RevenueService);
    }

    public async getEarnings(_req: Request, res: Response): Promise<void> {
        try {
            const earnings = await this.service.getEarnings();
            res.json(earnings);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching revenue earnings");
        }
    }
}
