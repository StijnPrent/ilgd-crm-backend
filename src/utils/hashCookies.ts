import { createHash } from "crypto";

export function hashCookies(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
}
