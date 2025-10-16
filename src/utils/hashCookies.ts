import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getSecret(): Buffer {
    const secret = process.env.F2F_COOKIE_SECRET || process.env.COOKIE_ENCRYPTION_SECRET;
    if (!secret) {
        throw new Error("F2F cookie encryption secret missing. Set F2F_COOKIE_SECRET environment variable.");
    }
    return createHash("sha256").update(secret, "utf8").digest();
}

export function hashCookies(input: string): string {
    const key = getSecret();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function unhashCookies(payload: string): string {
    if (!payload) {
        return "";
    }

    const buffer = Buffer.from(payload, "base64");
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error("Invalid encrypted cookie payload");
    }
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const key = getSecret();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
}
