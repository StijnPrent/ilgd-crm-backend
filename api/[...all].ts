// api/[...all].ts
import "reflect-metadata";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../src/app";

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Vercel strips the leading "/api" segment when invoking this function.
    // Add it back so Express routes using the "/api" prefix still match.
    if (!req.url?.startsWith("/api")) {
        req.url = `/api${req.url ?? ""}`;
    }
    return (app as any)(req, res);
}
