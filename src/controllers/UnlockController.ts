import {Request, Response} from "express";
import {container} from "tsyringe";
import {UnlockService} from "../business/services/UnlockService";

export class UnlockController {
    private get service(): UnlockService {
        return container.resolve(UnlockService);
    }

    public async perChatter(req: Request, res: Response): Promise<void> {
        try {
            const to = req.query.to ? new Date(String(req.query.to)) : new Date();
            const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 24*60*60*1000);
            const totals = await this.service.totalsByChatter(from, to);
            res.json(totals);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching unlock totals");
        }
    }
}
