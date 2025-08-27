// api/[...all].ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../src/app"; // because app.ts is at the repo root

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Express apps are request handlers; just pass the request to it.
    return (app as any)(req, res);
}
