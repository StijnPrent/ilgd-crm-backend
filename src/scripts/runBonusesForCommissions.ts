/**
 * Backfill bonus rules for each commission date/worker combination.
 *
 * Usage (PowerShell):
 *   # All companies
 *   npm run bonus:backfill
 *   # Single company
 *   npm run bonus:backfill -- --companyId=1
 *
 * Notes:
 * - Processes commission windows in chronological order to keep bonus_progress consistent.
 * - Uses commission_date (date-only) as the evaluation "asOf" (end of that day UTC).
 */
import "reflect-metadata";
import { container } from "tsyringe";
import "../container"; // register DI bindings
import { RowDataPacket } from "mysql2";
import pool from "../config/database";
import { BonusService } from "../business/services/BonusService";

interface BackfillTarget extends RowDataPacket {
    company_id: number;
    chatter_id: number;
    day: string; // DATE string
}

function parseArgs(): { companyId?: number } {
    const companyArg = process.argv.find(a => a.startsWith("--companyId="));
    if (!companyArg) return {};
    const raw = companyArg.split("=", 2)[1];
    const companyId = raw ? Number(raw) : undefined;
    if (!companyId || Number.isNaN(companyId)) {
        throw new Error("--companyId must be a valid number");
    }
    return { companyId };
}

async function fetchTargets(companyId?: number): Promise<BackfillTarget[]> {
    const where: string[] = ["chatter_id IS NOT NULL"];
    const params: any[] = [];
    if (companyId) {
        where.push("company_id = ?");
        params.push(companyId);
    }

    const sql = `
        SELECT DISTINCT company_id, chatter_id, DATE(commission_date) AS day
        FROM commissions
        WHERE ${where.join(" AND ")}
        ORDER BY company_id ASC, chatter_id ASC, day ASC
    `;
    const [rows] = await pool.query<BackfillTarget[]>(sql, params);
    return rows;
}

function toAsOf(dateStr: string): Date {
    // Use end-of-day UTC for the commission date window
    return new Date(`${dateStr}T23:59:59.999Z`);
}

async function main(): Promise<void> {
    const { companyId } = parseArgs();
    const targets = await fetchTargets(companyId);
    if (!targets.length) {
        console.log("[bonus-backfill] No commissions found for backfill");
        return;
    }

    const bonusService = container.resolve(BonusService);
    let snapshots = 0;

    for (const target of targets) {
        const asOf = toAsOf(target.day);
        const runs = await bonusService.runRules({
            companyId: target.company_id,
            workerId: target.chatter_id,
            asOf,
        });
        snapshots += runs.length;
        console.log(`[bonus-backfill] company=${target.company_id} worker=${target.chatter_id} date=${target.day} -> ${runs.length} evaluations`);
    }

    console.log(`[bonus-backfill] Completed. Evaluations: ${snapshots}, Windows processed: ${targets.length}`);
    await pool.end();
}

main().catch(err => {
    console.error("[bonus-backfill] Failed", err);
    process.exit(1);
});
