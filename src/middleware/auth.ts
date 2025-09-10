// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
    userId?: bigint;
}

export interface JwtPayload {
    userId: string;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        res.sendStatus(401); // Unauthorized - No return needed
        return;
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err: jwt.VerifyErrors | null, user: JwtPayload | undefined) => {
        if (err || !user?.userId) {
            res.sendStatus(403); // Forbidden - No return needed
            return;
        }
        req.userId = BigInt(user.userId);
        next();
    });
};