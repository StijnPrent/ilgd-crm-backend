import {inject, injectable} from "tsyringe";
import {IChatterRepository} from "../../data/interfaces/IChatterRepository";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {IModelRepository} from "../../data/interfaces/IModelRepository";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA = process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const COOKIES = "shield_FPC=SCCw3sIA5nuudpQTWSQODJuLw7qlxzBoKg; splash=true; intercom-device-id-r1f7b1gp=aeeb0d35-2f49-492d-848a-e1b7a48c63e3; csrftoken=88vIqGRLyEADnlumGSNq9f32CzsJSy8b; sessionid=bq3qq9gbvbrmh2hjb79grpli6s7fldg4; intercom-session-r1f7b1gp=WEVrT1Z4aHFaOG5lV2tZRExDT3MyTmltcFFwN3Q5MTR1TTdZWE1Fc0RTaDFZMmdkbDNucEtrSlI2Y3YvNGFDQnUyTHN0dGNScmJ4aVAxcVBtS3Zwa1FGbExMNitVNzkzRjc5QzRUYlFlOUE9LS1NYk1YOHNIK1ZTSVFURlFscWZFSHNnPT0=--87dd43f168c18288574dc4725278bf900e6e0307";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

@injectable()
export class F2FUnlockSyncService {
    constructor(
        @inject("IChatterRepository") private chatterRepo: IChatterRepository,
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        @inject("IModelRepository") private modelRepo: IModelRepository,
    ) {}

    private headersFor(creatorSlug?: string): Record<string, string> {
        const h: Record<string, string> = {
            accept: "application/json, text/plain, */*",
            "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
            "user-agent": UA,
            cookie: COOKIES,
            origin: BASE,
            referer: `${BASE}/`,
        };
        if (creatorSlug) h["impersonate-user"] = creatorSlug;
        return h;
    }

    private async fetchAllPages(startUrl: string, headers: Record<string, string>, label = ""): Promise<any[]> {
        let url: string | null = startUrl;
        const all: any[] = [];
        const seen = new Set<string>();

        while (url) {
            if (seen.has(url)) break;
            seen.add(url);

            const res = await fetch(url, {headers});
            const ct = res.headers.get("content-type") || "";
            const text = await res.text();
            if (!res.ok || ct.includes("text/html")) {
                throw new Error(`[${label}] Blocked/error ${res.status}. First 300 chars:\n${text.slice(0, 300)}`);
            }
            const page = JSON.parse(text);
            const items = Array.isArray(page) ? page : page.results || [];
            all.push(...items);
            url = page.next || null;
            if (url) await sleep(120);
        }
        return all;
    }

    private async getAllChatsForCreator(creator: string, fromDate: Date, toDate: Date): Promise<any[]> {
        console.log(`F2F: Fetching chats for ${creator}`);
        const chats = await this.fetchAllPages(
            `${BASE}/api/chats/?ordering=newest-first`,
            this.headersFor(creator),
            `chats:${creator}`
        );
        const inWindow = (iso: string) => {
            if (!iso) return false;
            const d = new Date(iso);
            return !Number.isNaN(d.getTime()) && d >= fromDate && d <= toDate;
        };
        return chats
            .filter((c: any) => inWindow(c.message?.datetime))
            .map((c: any) => ({
                id: c.uuid || c.id,
                title: c.title || "",
                username: c.other_user?.username || null,
                lastMessageAt: c.message?.datetime || null,
            }))
            .filter((c: any) => !!c.id);
    }

    private async getAllMessagesForChat(creator: string, chatId: string): Promise<any[]> {
        return this.fetchAllPages(`${BASE}/api/chats/${chatId}/messages/`, this.headersFor(creator), `msgs:${creator}:${chatId}`);
    }

    private pickUnlocksInWindow(messages: any[], fromDate: Date, toDate: Date): {datetime: string, price: number}[] {
        return messages
            .filter(m =>
                m.unlock &&
                typeof m.unlock.price !== "undefined" &&
                m.datetime &&
                new Date(m.datetime) >= fromDate &&
                new Date(m.datetime) <= toDate
            )
            .map(m => ({ datetime: m.datetime, price: Number(m.unlock.price) || 0 }));
    }

    public async syncLast24Hours(): Promise<void> {
        if (!COOKIES) {
            throw new Error("F2F_COOKIES env var required");
        }
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const models = await this.modelRepo.findAll();
        console.log(`F2F: Found ${models.length} models, syncing unlocks from ${from.toISOString()} to ${now.toISOString()}`);
        for (const model of models) {
            const creator = model.username;
            const chatter = await this.chatterRepo.findByEmail('womabusiness@outlook.com');
            console.log(`F2F: Processing model ${creator}, chatter ${chatter ? chatter.id : "NOT FOUND"}`);
            const chats = await this.getAllChatsForCreator(creator, from, now);
            console.log(`F2F: Found ${chats.length} chats with activity for ${creator}`);
            for (const chat of chats) {
                const msgs = await this.getAllMessagesForChat(creator, chat.id);
                console.log(`F2F: Chat ${chat.id} has ${msgs.length} messages`);
                const unlocks = this.pickUnlocksInWindow(msgs, from, now);
                console.log(`F2F: Chat ${chat.id} has ${unlocks.length} unlocks in window`);
                for (const u of unlocks) {
                    const ts = new Date(u.datetime);
                    const shift = await this.shiftRepo.findShiftForChatterAt(chatter!.id, ts);
                    console.log(`F2F: Logging earning for unlock in chat ${chat.id} at ${u.datetime} for $${u.price}`);
                    await this.earningRepo.create({
                        chatterId: chatter?.id || 0,
                        date: shift?.date || ts,
                        amount: u.price,
                        description: `unlock: ${creator} @ ${u.datetime.split("T")[0]}`,
                    });
                }
                await sleep(100);
            }
        }
    }
}
