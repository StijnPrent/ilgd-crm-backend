import {UserService} from "../business/services/UserService";
import {container} from "tsyringe";
import { Request, Response } from "express";

export class UserController {
    private get service(): UserService {
        return container.resolve(UserService);
    }

    public async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;
            const token = await this.service.login(email, password);
            if (!token) {
                res.status(401).send("Invalid credentials");
                return;
            }
            res.json({ token });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error logging in");
        }
    }
}