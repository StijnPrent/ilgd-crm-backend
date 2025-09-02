import {inject, injectable} from "tsyringe";
import {IChatterRepository} from "../../data/interfaces/IChatterRepository";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {IModelRepository} from "../../data/interfaces/IModelRepository";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA = process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const COOKIES = process.env.F2F_COOKIES || "";

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


    private async getAllChatsForCreator(creator: string, fromDate: Date, toDate: Date): Promise<any[]> {
        let url: string | null = `${BASE}/api/chats/?ordering=newest-first`;
        const headers = this.headersFor(creator);
        const all: any[] = [];
        const seen = new Set<string>();

        while (url) {
            if (seen.has(url)) break;
            seen.add(url);

            const res = await fetch(url, {headers});
            const ct = res.headers.get("content-type") || "";
            const text = await res.text();

            if (!res.ok || ct.includes("text/html")) {
                throw new Error(`[chats:${creator}] Blocked/error ${res.status}. First 300 chars:\n${text.slice(0, 300)}`);
            }

            const page = JSON.parse(text);
            const items = Array.isArray(page) ? page : page.results || [];
            all.push(...items);

            const last = items[items.length - 1];
            const lastDt = last?.message?.datetime;
            if (!lastDt || new Date(lastDt) < fromDate) {
                break;
            }

            url = page.next || null;
            if (url) await sleep(120);
        }

        const inWindow = (iso: string) => {
            if (!iso) return false;
            const d = new Date(iso);
            return !Number.isNaN(d.getTime()) && d >= fromDate && d <= toDate;
        };

        return all
            .filter((c: any) => inWindow(c.message?.datetime))
            .map((c: any) => ({
                id: c.uuid || c.id,
                title: c.title || "",
                username: c.other_user?.username || null,
                lastMessageAt: c.message?.datetime || null,
            }))
            .filter((c: any) => !!c.id);
    }

    private async getAllMessagesForChat(creator: string, chatId: string, fromDate: Date): Promise<any[]> {
        let url: string | null = `${BASE}/api/chats/${chatId}/messages/`;
        const headers = this.headersFor(creator);
        const all: any[] = [];
        const seen = new Set<string>();

        while (url) {
            if (seen.has(url)) break;
            seen.add(url);

            const res = await fetch(url, {headers});
            const ct = res.headers.get("content-type") || "";
            const text = await res.text();

            if (!res.ok || ct.includes("text/html")) {
                throw new Error(`[msgs:${creator}:${chatId}] Blocked/error ${res.status}. First 300 chars:\n${text.slice(0, 300)}`);
            }

            const page = JSON.parse(text);
            const items = Array.isArray(page) ? page : page.results || [];
            all.push(...items);

            const last = items[items.length - 1];
            const lastDt = last?.datetime;
            if (!lastDt || new Date(lastDt) < fromDate) {
                break;
            }

            url = page.next || null;
            if (url) await sleep(120);
        }

        return all;
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
        for (const model of models) {
            const creator = model.username;
            const chatter = await this.chatterRepo.findByEmail(creator);
            if (!chatter) continue;
            const chats = await this.getAllChatsForCreator(creator, from, now);
            for (const chat of chats) {
                const msgs = await this.getAllMessagesForChat(creator, chat.id, from);
                const unlocks = this.pickUnlocksInWindow(msgs, from, now);
                for (const u of unlocks) {
                    const ts = new Date(u.datetime);
                    const shift = await this.shiftRepo.findShiftForChatterAt(chatter.id, ts);
                    if (!shift) continue;
                    await this.earningRepo.create({
                        chatterId: chatter.id,
                        date: shift.date,
                        amount: u.price,
                        description: `unlock:${chat.id}:${u.datetime}`,
                    });
                }
                await sleep(100);
            }
        }
    }
}
