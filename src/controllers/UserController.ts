import {UserService} from "../business/services/UserService";
import {container} from "tsyringe";
import { Request, Response } from "express";

export class UserController {
    private get service(): UserService {
        return container.resolve(UserService);
    }

    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const users = await this.service.getAll();
            res.json(users.map(u => u.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching users");
        }
    }

    public async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const user = await this.service.getById(id);
            if (!user) {
                res.status(404).send("User not found");
                return;
            }
            res.json(user.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching user");
        }
    }

    public async create(req: Request, res: Response): Promise<void> {
        try {
            const { username, password, fullName, role } = req.body;
            const user = await this.service.create({ username, password, fullName, role });
            res.status(201).json(user.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error creating user");
        }
    }

    public async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const user = await this.service.update(id, req.body);
            if (!user) {
                res.status(404).send("User not found");
                return;
            }
            res.json(user.toJSON());
        } catch (err) {
            console.error(err);
            res.status(500).send("Error updating user");
        }
    }

    public async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            await this.service.delete(id);
            res.sendStatus(204);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error deleting user");
        }
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