/**
 * Bonus configuration.
 */
const DEFAULT_COMPANY_ID = Number(process.env.BONUS_DEFAULT_COMPANY_ID ?? process.env.DEFAULT_COMPANY_ID ?? 1);

export function resolveCompanyId(provided?: number | null): number {
    if (provided != null && !Number.isNaN(provided)) {
        return provided;
    }
    return DEFAULT_COMPANY_ID;
}
