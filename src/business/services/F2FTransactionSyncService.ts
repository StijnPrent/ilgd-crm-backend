/**
 * F2FTransactionSyncService module.
 */
import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {IModelRepository} from "../../data/interfaces/IModelRepository";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA = process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const COOKIES = process.env.F2F_COOKIES || "";

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
    ) {}

    /**
     * Builds request headers for F2F API calls.
     */
    private headers(): Record<string, string> {
        return {
            accept: "application/json, text/plain, */*",
            "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
            "user-agent": UA,
            cookie: COOKIES,
            origin: BASE,
            referer: `${BASE}/agency/transactions/`,
        };
    }

    /**
     * Fetches a single page of transactions from F2F API.
     */
    private async fetchTransactionsPage(url: string): Promise<{results: any[], next: string | null}> {
        const res = await fetch(url, {headers: this.headers()});
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
    private async fetchTransactions(): Promise<any[]> {
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

            const {results, next} = await this.fetchTransactionsPage(url);
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
    private async fetchTransactionDetail(id: string): Promise<any> {
        const res = await fetch(`${BASE}/api/agency/transactions/${id}/`, {headers: this.headers()});
        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        if (!res.ok || ct.includes("text/html")) {
            throw new Error(`transaction ${id} error ${res.status}. First 300 chars:\n${text.slice(0,300)}`);
        }
        return JSON.parse(text);
    }

    /**
     * Syncs recent transactions to earnings.
     */
    public async syncRecentTransactions(): Promise<void> {
        if (!COOKIES) {
            throw new Error("F2F_COOKIES env var required");
        }

        this.lastSeenUuid = await this.earningRepo.getLastId();
        const list = await this.fetchTransactions();
        if (!list.length) return;

        let newTxns = list;
        if (this.lastSeenUuid) {
            const idx = list.findIndex((t: any) => t.uuid === this.lastSeenUuid);
            if (idx >= 0) newTxns = list.slice(0, idx);
        }
        if (!newTxns.length) return;

        const models = await this.modelRepo.findAll();
        const modelMap = new Map<string, number>();
        for (const m of models) modelMap.set(m.username, m.id);

        // process oldest first
        for (const txn of newTxns.reverse()) {
            if (txn.uuid === this.lastSeenUuid) break;
            const id = txn.uuid;
            const existing = await this.earningRepo.findById(id);
            if (existing) continue;
            const detail = await this.fetchTransactionDetail(id);
            console.log(`Processing txn ${id} for user ${detail.user}, revenue ${detail.revenue}`);
            const revenue = Number(detail.revenue || 0);
            const creator = detail.creator || txn.creator;
            const model = modelMap.get(creator);
            console.log(` -> creator ${creator} maps to model id ${model}`);
            if (!model) continue;
            const ts = new Date(detail.created);
            const timeStr = ts.toTimeString().split(" ")[0];
            let chatterId: number | null = null;
            let date = ts;
            if (txn.object_type === "paypermessage" || txn.object_type === "tip") {
                const shift = await this.shiftRepo.findShiftForModelAt(model, ts);
                console.log(`  -> model ${creator} id ${model}, found shift: ${shift ? shift.id + ' models:' + shift.modelIds.join(',') : 'NO SHIFT'}`);
                chatterId = shift ? shift.chatterId : null;
            }
            const txnType = txn.object_type?.startsWith("subscriptionperiod")
                ? "subscriptionperiod"
                : txn.object_type;
            const modelId = model ? model : null
            await this.earningRepo.create({
                id,
                chatterId,
                modelId,
                date,
                amount: revenue,
                description: `F2F: -User: ${detail.user} - Time: ${timeStr}`,
                type: txnType,
            });
        }
    }
}

