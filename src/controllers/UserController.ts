import {UserService} from "../business/services/UserService";
import {container} from "tsyringe";
import { Request, Response } from "express";
import {UserModel} from "../business/models/UserModel";

/**
 * Controller handling CRUD operations and authentication for users.
 */
export class UserController {
    private get service(): UserService {
        return container.resolve(UserService);
    }

    /**
     * Retrieves all users.
     * @param _req Express request object.
     * @param res Express response object.
     */
    public async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const users = await this.service.getAll();
            res.json(users.map(u => u.toJSON()));
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching users");
        }
    }

    /**
     * Retrieves a user by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
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

    /**
     * Creates a new user.
     * @param req Express request object.
     * @param res Express response object.
     */
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

    /**
     * Updates an existing user.
     * @param req Express request object.
     * @param res Express response object.
     */
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

    /**
     * Deletes a user by ID.
     * @param req Express request object.
     * @param res Express response object.
     */
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

    /**
     * Authenticates a user and returns a JWT token.
     * @param req Express request object.
     * @param res Express response object.
     */
    public async login(req: Request, res: Response): Promise<void> {
        try {
            const { username, password } = req.body as { username?: string; password?: string };

            if (!username || !password) {
                res.status(400).json({ error: "Username and password are required" });
                return;
            }

            const result = await this.service.login(username, password);

            if (!result || !result.token) {
                res.status(401).json({ error: "Invalid credentials" });
                return;
            }

            const { token, user }: { token: string; user: UserModel | any } = result;

            const userJson = typeof user?.toJSON === "function" ? user.toJSON() : user;

            res.json({ token, user: userJson });
        } catch (err) {
            console.error("[users.login] error:", err);
            res.status(500).json({ error: "Error logging in" });
        }
    }
}