/**
 * F2FTransactionSyncService module.
 */
import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {IModelRepository} from "../../data/interfaces/IModelRepository";
import {IF2FCookieSettingRepository} from "../../data/interfaces/IF2FCookieSettingRepository";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA = process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Service that syncs recent transactions from F2F.
 */
@injectable()
/**
 * F2FTransactionSyncService class.
 */
export class F2FTransactionSyncService {
    private lastSeenUuid: string | null = null;

    constructor(
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        @inject("IModelRepository") private modelRepo: IModelRepository,
        @inject("IF2FCookieSettingRepository") private cookieRepo: IF2FCookieSettingRepository,
    ) {}

    private buildHeaders(cookieString: string): Record<string, string> {
        return {
            accept: "application/json, text/plain, */*",
            "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
            "user-agent": UA,
            cookie: cookieString,
            origin: BASE,
            referer: `${BASE}/agency/transactions/`,
        };
    }

    private async requireCookies(): Promise<string> {
        const record = await this.cookieRepo.getF2FCookies();
        const cookies = record?.cookies ?? "";
        if (!cookies) {
            throw new Error("F2F cookies not configured");
        }
        return cookies;
    }

    /**
     * Fetches a single page of transactions from F2F API.
     */
    private async fetchTransactionsPage(url: string, cookieString: string): Promise<{results: any[], next: string | null}> {
        const res = await fetch(url, {headers: this.buildHeaders(cookieString)});
        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        if (!res.ok || ct.includes("text/html")) {
            throw new Error(`transactions list error ${res.status}. First 300 chars:\n${text.slice(0,300)}`);
        }
        const data = JSON.parse(text);
        return {results: data.results || [], next: data.next || null};
    }

    /**
     * Fetches recent transactions, following pagination until the last known
     * transaction is encountered or the start of the current month is
     * exceeded.
     */
    private async fetchTransactions(cookieString: string): Promise<any[]> {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        let url: string | null = `${BASE}/api/agency/transactions/`;
        const all: any[] = [];
        const seenPages = new Set<string>();

        while (url) {
            if (seenPages.has(url)) {
                console.warn(`Transactions page ${url} already processed, stopping pagination`);
                break;
            }
            seenPages.add(url);

            const {results, next} = await this.fetchTransactionsPage(url, cookieString);
            all.push(...results);

            const seenLast = this.lastSeenUuid && results.some((t: any) => t.uuid === this.lastSeenUuid);
            const last = results[results.length - 1];
            const tooOld = last ? new Date(last.created) < startOfMonth : false;
            if (seenLast || tooOld) break;

            url = next;
        }

        return all.filter(t => new Date(t.created) >= startOfMonth);
    }

    /**
     * Fetches detailed information for a transaction.
     * @param id Transaction identifier.
     */
    private async fetchTransactionDetail(id: string, cookieString: string): Promise<any> {
        const res = await fetch(`${BASE}/api/agency/transactions/${id}/`, {headers: this.buildHeaders(cookieString)});
        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        if (!res.ok || ct.includes("text/html")) {
            throw new Error(`transaction ${id} error ${res.status}. First 300 chars:\n${text.slice(0,300)}`);
        }
        return JSON.parse(text);
    }

    private async buildModelMap(): Promise<Map<string, number>> {
        const models = await this.modelRepo.findAll();
        const modelMap = new Map<string, number>();
        for (const m of models) modelMap.set(m.username, m.id);
        return modelMap;
    }

    private determineType(txn: any, detail: any): string | undefined {
        const objectType: string | undefined = txn?.object_type ?? detail?.object_type;
        if (!objectType) return undefined;

        if (!objectType.startsWith("subscriptionperiod")) {
            return objectType;
        }

        const variant = this.extractSubscriptionVariant(detail);
        return variant ? `subscriptionperiod:${variant}` : "subscriptionperiod";
    }

    private extractSubscriptionVariant(detail: any): string | undefined {
        if (!detail || typeof detail !== "object") {
            return undefined;
        }

        const direct = this.normalizeSubscriptionDescriptor(detail.subscription_period);
        if (direct) {
            return direct;
        }

        const candidatePaths: string[][] = [
            ["subscription", "period"],
            ["subscription", "period_display"],
            ["subscription", "duration"],
            ["subscription", "interval"],
            ["subscription", "plan", "period"],
            ["subscription", "plan", "duration"],
            ["subscription_plan", "period"],
            ["subscription_plan", "duration"],
            ["subscription_plan", "interval"],
            ["plan", "period"],
            ["plan", "duration"],
            ["plan", "interval"],
            ["plan", "name"],
            ["product", "period"],
            ["product", "duration"],
            ["product", "interval"],
            ["product", "name"],
            ["product", "title"],
            ["offer", "title"],
        ];

        for (const path of candidatePaths) {
            const value = this.getNestedProperty(detail, path);
            const normalized = this.normalizeSubscriptionDescriptor(value);
            if (normalized) {
                return normalized;
            }
        }

        const textualSources = [
            detail.description,
            detail.note,
            detail.display_name,
            detail.subscription?.name,
            detail.subscription?.plan?.name,
            detail.subscription_plan?.name,
        ];

        for (const source of textualSources) {
            const normalized = this.normalizeSubscriptionDescriptor(source);
            if (normalized) {
                return normalized;
            }
        }

        return undefined;
    }

    private normalizeSubscriptionDescriptor(value: unknown): string | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            if (value === 1) {
                return "monthly";
            }
            if (value > 1) {
                return `${value}-month`;
            }
            return undefined;
        }

        const raw = String(value).trim();
        if (!raw) {
            return undefined;
        }

        const lower = raw.toLowerCase();

        if (lower === "1" || lower === "one" || /\bmonthly\b/.test(lower)) {
            return "monthly";
        }

        const monthMatch = lower.match(/(\d+)\s*(?:month|mo)s?\b/);
        if (monthMatch) {
            const count = Number(monthMatch[1]);
            if (!isNaN(count) && count > 0) {
                return count === 1 ? "monthly" : `${count}-month`;
            }
        }

        const yearMatch = lower.match(/(\d+)\s*(?:year|yr)s?\b/);
        if (yearMatch) {
            const years = Number(yearMatch[1]);
            if (!isNaN(years) && years > 0) {
                return years === 1 ? "annual" : `${years}-year`;
            }
        }

        if (lower.includes("annual")) {
            return "annual";
        }
        if (lower.includes("quarter")) {
            return "quarterly";
        }

        const sanitized = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return sanitized || undefined;
    }

    private getNestedProperty(source: any, path: string[]): unknown {
        let current = source;
        for (const key of path) {
            if (!current || typeof current !== "object") {
                return undefined;
            }
            current = current[key];
        }
        return current;
    }

    private async createEarningForTransaction(
        txn: any,
        modelMap: Map<string, number>,
        cookieString: string
    ): Promise<boolean> {
        const id = txn.uuid;
        if (!id) return false;

        const existing = await this.earningRepo.findById(id);
        if (existing) return false;

        const detail = await this.fetchTransactionDetail(id, cookieString);
        console.log(`Processing txn ${id} for user ${detail.user}, revenue ${detail.revenue}`);
        console.log(` -> created ${detail.created}`);

        const revenue = Number(detail.revenue || 0);
        const creator = detail.creator || txn.creator;
        const model = creator ? modelMap.get(creator) : undefined;
        console.log(` -> creator ${creator} maps to model id ${model}`);
        if (!model) return false;

        const ts = new Date(detail.created);
        const timeStr = ts.toTimeString().split(" ")[0];

        let chatterId: number | null = null;
        let shiftId: number | null = null;
        if (txn.object_type === "paypermessage" || txn.object_type === "tip") {
            const shift = await this.shiftRepo.findShiftForModelAt(model, ts);
            console.log(`  -> model ${creator} id ${model}, found shift: ${shift ? shift.id + ' models:' + shift.modelIds.join(',') : 'NO SHIFT'}`);
            chatterId = shift ? shift.chatterId : null;
            shiftId = shift ? shift.id : null;
        }

        await this.earningRepo.create({
            id,
            chatterId,
            modelId: model ?? null,
            shiftId,
            date: detail.created,
            amount: revenue,
            description: `F2F: -User: ${detail.user} - Time: ${timeStr}`,
            type: this.determineType(txn, detail),
        });

        return true;
    }

    private async fetchTransactionsBetween(from: Date, to: Date, cookieString: string): Promise<any[]> {
        let url: string | null = `${BASE}/api/agency/transactions/`;
        const all: any[] = [];
        const seenPages = new Set<string>();

        while (url) {
            if (seenPages.has(url)) {
                console.warn(`Transactions page ${url} already processed, stopping pagination`);
                break;
            }
            seenPages.add(url);

            const {results, next} = await this.fetchTransactionsPage(url, cookieString);
            all.push(...results);

            const last = results[results.length - 1];
            const tooOld = last ? new Date(last.created) < from : false;
            if (tooOld) break;

            url = next;
        }

        return all.filter(t => {
            const created = new Date(t.created);
            return created >= from && created <= to;
        });
    }

    /**
     * Syncs recent transactions to earnings.
     * @returns Number of new earnings created during the sync.
     */
    public async syncRecentTransactions(): Promise<number> {
        const cookieString = await this.requireCookies();

        this.lastSeenUuid = await this.earningRepo.getLastId();
        const list = await this.fetchTransactions(cookieString);
        if (!list.length) return 0;

        let newTxns = list;
        if (this.lastSeenUuid) {
            const idx = list.findIndex((t: any) => t.uuid === this.lastSeenUuid);
            if (idx >= 0) newTxns = list.slice(0, idx);
        }
        if (!newTxns.length) return 0;

        const modelMap = await this.buildModelMap();

        // process oldest first
        let created = 0;
        for (const txn of newTxns.reverse()) {
            if (txn.uuid === this.lastSeenUuid) break;
            const didCreate = await this.createEarningForTransaction(txn, modelMap, cookieString);
            if (didCreate) {
                created++;
            }
        }

        return created;
    }

    public async syncTransactionsBetween(from: Date, to: Date): Promise<number> {
        const cookieString = await this.requireCookies();

        if (from > to) return 0;

        const txns = await this.fetchTransactionsBetween(from, to, cookieString);
        if (!txns.length) return 0;

        const modelMap = await this.buildModelMap();
        txns.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

        let created = 0;
        for (const txn of txns) {
            const didCreate = await this.createEarningForTransaction(txn, modelMap, cookieString);
            if (didCreate) created++;
            await sleep(100);
        }

        return created;
    }
}

