import {inject, injectable} from "tsyringe";
import {IUserRepository} from "../../data/interfaces/IUserRepository";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {UserModel} from "../models/UserModel";
import {Role} from "../../rename/types";

/**
 * Service responsible for user management and authentication.
 */
@injectable()
export class UserService {
    constructor(
        @inject("IUserRepository") private userRepo: IUserRepository
    ) {}

    /**
     * Retrieves all users.
     */
    public async getAll(): Promise<UserModel[]> {
        return this.userRepo.findAll();
    }

    /**
     * Retrieves a user by ID.
     * @param id User identifier.
     */
    public async getById(id: number): Promise<UserModel | null> {
        return this.userRepo.findById(id);
    }

    /**
     * Creates a new user.
     * @param data User details.
     */
    public async create(data: { username: string; password: string; fullName: string; role: Role; }): Promise<UserModel> {
        const passwordHash = await bcrypt.hash(data.password, 10);
        return this.userRepo.create({
            username: data.username,
            passwordHash,
            fullName: data.fullName,
            role: data.role,
        });
    }

    /**
     * Updates an existing user.
     * @param id User identifier.
     * @param data Partial user data.
     */
    public async update(id: number, data: { username?: string; password?: string; fullName?: string; role?: Role; }): Promise<UserModel | null> {
        const updateData: any = { ...data };
        if (data.password) {
            updateData.passwordHash = await bcrypt.hash(data.password, 10);
            delete updateData.password;
        }
        return this.userRepo.update(id, updateData);
    }

    /**
     * Deletes a user.
     * @param id User identifier.
     */
    public async delete(id: number): Promise<void> {
        await this.userRepo.delete(id);
    }

    /**
     * Authenticates a user using their username and generates a JWT token.
     * @param username User's username.
     * @param password Plain text password.
     */
    public async login(username: string, password: string): Promise<{token: string, user: UserModel} | null> {
        const user = await this.userRepo.findByUsername(username);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const token = (jwt.sign(
            { userId: user.id.toString(),  },
            process.env.JWT_SECRET!,
            { expiresIn: "8h" }
        ));

        return { token, user };
    }
}