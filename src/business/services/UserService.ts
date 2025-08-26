import {inject, injectable} from "tsyringe";
import {IUserRepository} from "../../data/interfaces/IUserRepository";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

@injectable()
export class UserService {
    constructor(
        @inject("IUserRepository") private userRepo: IUserRepository
    ) {}

    public async login(email: string, password: string): Promise<string | null> {
        const user = await this.userRepo.findByEmail(email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return jwt.sign(
            { companyId: user.id.toString() },
            process.env.JWT_SECRET!,
            { expiresIn: "8h" }
        );
    }
}