import { randomBytes } from "crypto";

let counter = 0;

export function generateCuid(): string {
    counter = (counter + 1) % 1679616; // 36^4
    const timestamp = Date.now().toString(36);
    const counterSegment = counter.toString(36).padStart(4, "0");
    const randomSegment = randomBytes(6).toString("hex");
    return `c${timestamp}${counterSegment}${randomSegment}`.slice(0, 25);
}
