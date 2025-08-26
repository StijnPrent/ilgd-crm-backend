import {inject, injectable} from "tsyringe";
import {IUserRepository} from "../../data/interfaces/IUserRepository";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {UserModel} from "../models/UserModel";
import {Role} from "../../rename/types";

@injectable()
export class UserService {
    constructor(
        @inject("IUserRepository") private userRepo: IUserRepository
    ) {}

    public async getAll(): Promise<UserModel[]> {
        return this.userRepo.findAll();
    }

    public async getById(id: number): Promise<UserModel | null> {
        return this.userRepo.findById(id);
    }

    public async create(data: { username: string; password: string; fullName: string; role: Role; }): Promise<UserModel> {
        const passwordHash = await bcrypt.hash(data.password, 10);
        return this.userRepo.create({
            username: data.username,
            passwordHash,
            fullName: data.fullName,
            role: data.role,
        });
    }

    public async update(id: number, data: { username?: string; password?: string; fullName?: string; role?: Role; }): Promise<UserModel | null> {
        const updateData: any = { ...data };
        if (data.password) {
            updateData.passwordHash = await bcrypt.hash(data.password, 10);
            delete updateData.password;
        }
        return this.userRepo.update(id, updateData);
    }

    public async delete(id: number): Promise<void> {
        await this.userRepo.delete(id);
    }

    public async login(email: string, password: string): Promise<{token: string, user: UserModel} | null> {
        const user = await this.userRepo.findByEmail(email);
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