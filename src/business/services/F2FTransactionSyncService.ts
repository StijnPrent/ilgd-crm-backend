import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {IModelRepository} from "../../data/interfaces/IModelRepository";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA = process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const COOKIES = "shield_FPC=SCCw3sIA5nuudpQTWSQODJuLw7qlxzBoKg; splash=true; intercom-device-id-r1f7b1gp=aeeb0d35-2f49-492d-848a" +
    "-e1b7a48c63e3; csrftoken=88vIqGRLyEADnlumGSNq9f32CzsJSy8b; sessionid=bq3qq9gbvbrmh2hjb79grpli6s7fldg4; intercom-session-r1f7b1gp" +
    "=WEVrT1Z4aHFaOG5lV2tZRExDT3MyTmltcFFwN3Q5MTR1TTdZWE1Fc0RTaDFZMmdkbDNucEtrSlI2Y3YvNGFDQnUyTHN0dGNScmJ4aVAxcVBtS3Zwa1FGbExMNitVNzk" +
    "zRjc5QzRUYlFlOUE9LS1NYk1YOHNIK1ZTSVFURlFscWZFSHNnPT0=--87dd43f168c18288574dc4725278bf900e6e0307";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

@injectable()
export class F2FTransactionSyncService {
    private lastSeenUuid: string | null = null;

    constructor(
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        @inject("IModelRepository") private modelRepo: IModelRepository,
    ) {}

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

    private async fetchTransactions(): Promise<any[]> {
        const res = await fetch(`${BASE}/api/agency/transactions/`, {headers: this.headers()});
        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        if (!res.ok || ct.includes("text/html")) {
            throw new Error(`transactions list error ${res.status}. First 300 chars:\n${text.slice(0,300)}`);
        }
        const data = JSON.parse(text);
        return data.results || [];
    }

    private async fetchTransactionDetail(id: string): Promise<any> {
        const res = await fetch(`${BASE}/api/agency/transactions/${id}/`, {headers: this.headers()});
        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        if (!res.ok || ct.includes("text/html")) {
            throw new Error(`transaction ${id} error ${res.status}. First 300 chars:\n${text.slice(0,300)}`);
        }
        return JSON.parse(text);
    }

    public async syncRecentPayPerMessage(): Promise<void> {
        if (!COOKIES) {
            throw new Error("F2F_COOKIES env var required");
        }

        const list = await this.fetchTransactions();
        const payPerMessages = list.filter((t: any) => t.object_type === "paypermessage");
        if (!payPerMessages.length) return;

        let newTxns = payPerMessages;
        if (this.lastSeenUuid) {
            const idx = payPerMessages.findIndex((t: any) => t.uuid === this.lastSeenUuid);
            if (idx >= 0) newTxns = payPerMessages.slice(0, idx);
        }
        if (!newTxns.length) return;

        const models = await this.modelRepo.findAll();
        const modelMap = new Map<string, number>();
        for (const m of models) modelMap.set(m.username, m.id);

        // process oldest first
        for (const txn of newTxns.reverse()) {
            const detail = await this.fetchTransactionDetail(txn.uuid);
            const revenue = Number(detail.net_revenue || detail.revenue || 0);
            const creator = detail.creator || txn.creator;
            const modelId = modelMap.get(creator);
            if (!modelId) continue;
            const ts = new Date(detail.created);
            const shift = await this.shiftRepo.findShiftForModelAt(modelId, ts);
            if (!shift) continue;
            await this.earningRepo.create({
                chatterId: shift.chatterId,
                date: shift.date,
                amount: revenue,
                description: `paypermessage: ${detail.user}`,
            });
            await sleep(50);
        }

        this.lastSeenUuid = payPerMessages[0].uuid;
    }
}

