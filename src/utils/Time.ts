import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { endOfDay, startOfDay } from "date-fns";

export const BUSINESS_TIMEZONE = "Europe/Amsterdam";

const OFFSET_REGEX = /(z|Z|[+-]\d{2}:?\d{2})$/;

function normalizeDateInput(value: Date | string): Date {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new Error("Invalid date input");
        }
        return value;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }
    throw new Error(`Invalid date string: ${value}`);
}

export function parseDateAssumingZone(value: Date | string, zone: string = BUSINESS_TIMEZONE): Date {
    if (value instanceof Date) {
        return value;
    }
    const trimmed = String(value).trim();
    if (OFFSET_REGEX.test(trimmed)) {
        const d = new Date(trimmed);
        if (!Number.isNaN(d.getTime())) {
            return d;
        }
    }
    const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    return fromZonedTime(normalized, zone);
}

export function formatDateInZone(date: Date, zone: string = BUSINESS_TIMEZONE, pattern = "yyyy-MM-dd'T'HH:mm:ssXXX"): string {
    return formatInTimeZone(normalizeDateInput(date), zone, pattern);
}

export function toZonedDate(date: Date, zone: string = BUSINESS_TIMEZONE): Date {
    return toZonedTime(normalizeDateInput(date), zone);
}

export function startOfBusinessDayUtc(date: Date, zone: string = BUSINESS_TIMEZONE): Date {
    const zoned = toZonedTime(normalizeDateInput(date), zone);
    return fromZonedTime(startOfDay(zoned), zone);
}

export function endOfBusinessDayUtc(date: Date, zone: string = BUSINESS_TIMEZONE): Date {
    const zoned = toZonedTime(normalizeDateInput(date), zone);
    return fromZonedTime(endOfDay(zoned), zone);
}

export function utcDateToSql(date: Date): string {
    const d = normalizeDateInput(date);
    return new Date(Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
    )).toISOString().slice(0, 19).replace("T", " ");
}

