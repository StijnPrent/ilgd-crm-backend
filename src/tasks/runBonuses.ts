/**
 * Simple task runner to execute active bonus rules.
 *
 * Usage:
 *   ts-node src/tasks/runBonuses.ts --companyId=123 [--workerId=456] [--asOf=2025-01-31T23:59:59Z]
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { BonusService } from "../business/services/BonusService";

function parseArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    for (const a of process.argv.slice(2)) {
        if (a.startsWith(prefix)) return a.substring(prefix.length);
        if (a === `--${name}`) return "true";
    }
    return undefined;
}

async function main() {
    const companyIdStr = 1;
    if (!companyIdStr) {
        throw new Error("--companyId is required");
    }
    const workerIdStr = parseArg("workerId");
    const asOfStr = parseArg("asOf");
    const companyId = Number(companyIdStr);
    const workerId = workerIdStr != null ? Number(workerIdStr) : undefined;
    const asOf = asOfStr ? new Date(asOfStr) : new Date();

    const bonusService = container.resolve(BonusService);
    const snapshots = await bonusService.runRules({
        companyId,
        workerId: workerId ?? null,
        asOf,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ count: snapshots.length, evaluations: snapshots }, null, 2));
}

main().catch(err => {
    // eslint-disable-next-line no-console
    console.error("[bonus] run task failed", err);
    process.exit(1);
});

