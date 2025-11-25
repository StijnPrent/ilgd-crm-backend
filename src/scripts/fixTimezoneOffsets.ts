import "dotenv/config";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { fromZonedTime } from "date-fns-tz";
import { BUSINESS_TIMEZONE, utcDateToSql } from "../utils/Time";

interface Target {
    table: string;
    idColumn: string;
    columns: string[];
}

const TARGETS: Target[] = [
    { table: "employee_earnings", idColumn: "id", columns: ["date"] },
    { table: "shifts", idColumn: "id", columns: ["start_time", "end_time"] },
    // commissions table intentionally excluded: commission_date is a DATE (no timezone)
    { table: "bonus_awards", idColumn: "id", columns: ["awarded_at"] },
    { table: "bonus_progress", idColumn: "id", columns: ["last_computed_at"] },
];

interface CliOptions {
    dryRun: boolean;
    limit: number;
    preview: number;
    before: string;
    tables?: Set<string>;
    excludeIds?: Set<string>;
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    let dryRun = true;
    let limit = 500;
    let preview = 5;
    let before: string | undefined;
    let tables: Set<string> | undefined;
    let excludeIds: Set<string> | undefined;

    const getVal = (idx: number, fallback?: string) => (args[idx + 1] && !args[idx + 1].startsWith("--")) ? args[idx + 1] : fallback;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--apply") {
            dryRun = false;
        } else if (arg.startsWith("--limit=")) {
            limit = Number(arg.split("=", 2)[1] ?? limit);
        } else if (arg === "--limit") {
            limit = Number(getVal(i, String(limit)));
            i++;
        } else if (arg.startsWith("--preview=")) {
            preview = Number(arg.split("=", 2)[1] ?? preview);
        } else if (arg === "--preview") {
            preview = Number(getVal(i, String(preview)));
            i++;
        } else if (arg.startsWith("--before=")) {
            const raw = arg.split("=", 2)[1];
            if (raw) before = raw;
        } else if (arg === "--before") {
            const raw = getVal(i);
            if (raw) before = raw;
            i++;
        } else if (arg.startsWith("--tables=")) {
            const list = arg.split("=", 2)[1];
            if (list) tables = new Set(list.split(",").map(v => v.trim()).filter(Boolean));
        } else if (arg === "--tables") {
            const list = getVal(i);
            if (list) tables = new Set(list.split(",").map(v => v.trim()).filter(Boolean));
            i++;
        } else if (arg.startsWith("--excludeIds=")) {
            const list = arg.split("=", 2)[1];
            if (list) excludeIds = new Set(list.split(",").map(v => v.trim()).filter(Boolean));
        } else if (arg === "--excludeIds") {
            const list = getVal(i);
            if (list) excludeIds = new Set(list.split(",").map(v => v.trim()).filter(Boolean));
            i++;
        }
    }

    // Allow env var and npm config fallbacks (Windows/npm quirks)
    // Examples that will populate these:
    //   npm run fix:timezones -- --before=2025-12-31T23:59:59Z
    //   $env:BEFORE="2025-12-31T23:59:59Z"; npm run fix:timezones
    //   set BEFORE=2025-12-31T23:59:59Z && npm run fix:timezones
    if (!before) {
        before = process.env.npm_config_before
            || process.env.npm_config_BEFORE
            || process.env.BEFORE
            || process.env.before
            || undefined;
    }

    if (!before) {
        // Help debug arg passing issues on Windows/PowerShell
        // eslint-disable-next-line no-console
        console.error("Received argv:", JSON.stringify(process.argv));
        throw new Error("--before is required (ISO datetime), e.g. 2025-01-31T23:59:59Z");
    }

    const dt = new Date(before);
    if (Number.isNaN(dt.getTime())) {
        throw new Error(`Invalid --before datetime: ${before}`);
    }
    const beforeSql = utcDateToSql(dt);

    return { dryRun, limit, preview, before: beforeSql, tables, excludeIds };
}

async function main(): Promise<void> {
    const opts = parseArgs();
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        waitForConnections: true,
        connectionLimit: 2,
        dateStrings: true,
        timezone: "Z",
    });

    try {
        const connection = await pool.getConnection();
        await connection.query("SET time_zone = '+00:00'");
        connection.release();

        for (const target of TARGETS) {
            if (opts.tables && !opts.tables.has(target.table)) {
                continue;
            }
            for (const column of target.columns) {
                await processColumn(pool, target, column, opts);
            }
        }
    } finally {
        await pool.end();
    }
}

async function processColumn(
    pool: mysql.Pool,
    target: Target,
    column: string,
    opts: CliOptions,
): Promise<void> {
    const tableLabel = `${target.table}.${column}`;
    console.log(`[fix-tz] Processing ${tableLabel}`);
    let lastId = 0;
    let total = 0;
    let previewCount = 0;

    while (true) {
        const params: any[] = [];
        const where: string[] = [`${column} IS NOT NULL`, `${column} < ?`];
        params.push(opts.before);
        if (lastId) {
            where.push(`${target.idColumn} > ?`);
            params.push(lastId);
        }
        if (opts.excludeIds && opts.excludeIds.size) {
            const placeholders = Array.from(opts.excludeIds).map(() => "?").join(", ");
            where.push(`${target.idColumn} NOT IN (${placeholders})`);
            params.push(...Array.from(opts.excludeIds));
        }
        const sql = `SELECT ${target.idColumn} AS id, ${column} AS value
                     FROM ${target.table}
                     WHERE ${where.join(" AND ")}
                     ORDER BY ${target.idColumn} ASC
                     LIMIT ?`;
        params.push(opts.limit);
        const [rows] = await pool.query<RowDataPacket[]>(sql, params);
        if (!rows.length) {
            break;
        }

        for (const rowRaw of rows) {
            const row = rowRaw as RowDataPacket & { id: number; value: string | null; };
            lastId = Number(row.id);
            if (!row.value) {
                continue;
            }
            const normalized = row.value.replace(" ", "T");
            const converted = fromZonedTime(normalized, BUSINESS_TIMEZONE);
            const formatted = utcDateToSql(converted);

            if (opts.dryRun) {
                if (previewCount < opts.preview) {
                    console.log(`[dry-run] ${tableLabel} id=${row.id}: ${row.value} -> ${formatted}`);
                    previewCount++;
                }
                continue;
            }

            await pool.query(
                `UPDATE ${target.table} SET ${column} = ? WHERE ${target.idColumn} = ?`,
                [formatted, row.id],
            );
            total++;
        }

        if (opts.dryRun) {
            break;
        }
    }

    if (opts.dryRun) {
        console.log(`[dry-run] ${tableLabel} preview complete (limit ${opts.preview})`);
    } else {
        console.log(`[fix-tz] ${tableLabel}: updated ${total} rows`);
    }
}

main().catch(err => {
    console.error("[fix-tz] Failed", err);
    process.exit(1);
});
