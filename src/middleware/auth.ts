/**
 * auth module.
 */
// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Express request extended with an optional authenticated user ID.
 */
/**
 * AuthenticatedRequest interface.
 */
export interface AuthenticatedRequest extends Request {
    /**
     * Identifier of the authenticated user if a valid token is provided.
     */
    userId?: bigint;
}

/**
 * Structure of the JWT payload expected by the application.
 */
/**
 * JwtPayload interface.
 */
export interface JwtPayload {
    /**
     * Identifier of the authenticated user encoded as a string.
     */
    userId: string;
}

/**
 * Middleware that verifies a JWT token from the `Authorization` header and
 * attaches the corresponding `userId` to the request object. Responds with
 * `401` if no token is provided or `403` if the token is invalid.
 *
 * @param req - Express request possibly containing a JWT token.
 * @param res - Express response used to send error codes.
 * @param next - Callback to pass control to the next middleware.
 */
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        res.sendStatus(401); // Unauthorized - No return needed
        return;
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
        if (err) {
            res.sendStatus(403); // Forbidden - No return needed
            return;
        }
        const payload = typeof user === "string" ? undefined : user;
        const userId = (payload && typeof payload === "object" && "userId" in payload)
            ? (payload as JwtPayload).userId
            : undefined;
        if (!userId) {
            res.sendStatus(403);
            return;
        }
        req.userId = BigInt(userId);
        next();
    });
};
