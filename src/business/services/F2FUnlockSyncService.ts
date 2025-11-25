/**
 * F2FUnlockSyncService module.
 */
import {inject, injectable} from "tsyringe";
import {IChatterRepository} from "../../data/interfaces/IChatterRepository";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {IModelRepository} from "../../data/interfaces/IModelRepository";
import {IF2FCookieSettingRepository} from "../../data/interfaces/IF2FCookieSettingRepository";
import { resolveCompanyId } from "../../config/bonus";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA = process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Service that synchronizes unlock earnings from the F2F platform.
 */
@injectable()
/**
 * F2FUnlockSyncService class.
 */
export class F2FUnlockSyncService {
    constructor(
        @inject("IChatterRepository") private chatterRepo: IChatterRepository,
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        @inject("IModelRepository") private modelRepo: IModelRepository,
        @inject("IF2FCookieSettingRepository") private cookieRepo: IF2FCookieSettingRepository,
    ) {}
    private readonly companyId = resolveCompanyId();

    /**
     * Builds request headers for F2F API calls.
     * @param creatorSlug Optional creator slug for impersonation.
     */
    private headersFor(cookieString: string, creatorSlug?: string): Record<string, string> {
        const h: Record<string, string> = {
            accept: "application/json, text/plain, */*",
            "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
            "user-agent": UA,
            cookie: cookieString,
            origin: BASE,
            referer: `${BASE}/`,
        };
        if (creatorSlug) h["impersonate-user"] = creatorSlug;
        return h;
    }

    private async requireCookies(): Promise<string> {
        const record = await this.cookieRepo.getF2FCookies({ companyId: this.companyId });
        const cookies = record?.cookies ?? "";
        if (!cookies) {
            throw new Error("F2F cookies not configured");
        }
        return cookies;
    }

    /**
     * Fetches paginated resources until exhausted or stop condition.
     * @param startUrl Initial URL to fetch.
     * @param headers Request headers.
     * @param label Log label.
     * @param stopWhen Optional predicate to stop fetching.
     */
    private async fetchAllPages(
        startUrl: string,
        headers: Record<string, string>,
        label = "",
        stopWhen?: (items: any[]) => boolean
    ): Promise<any[]> {
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
            if (stopWhen && stopWhen(items)) break;
            url = page.next || null;
            if (url) await sleep(120);
        }
        return all;
    }

    /**
     * Retrieves chats for a creator within a date range.
     * @param creator Creator username.
     * @param fromDate Start date.
     * @param toDate End date.
     */
    private async getAllChatsForCreator(creator: string, fromDate: Date, toDate: Date, cookieString: string): Promise<any[]> {
        console.log(`F2F: Fetching chats for ${creator}`);
        const chats = await this.fetchAllPages(
            `${BASE}/api/chats/?ordering=newest-first?read=false`,
            this.headersFor(cookieString, creator),
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

    /**
     * Retrieves messages for a chat, stopping when older than fromDate.
     * @param creator Creator username.
     * @param chatId Chat identifier.
     * @param fromDate Lower date bound.
     */
    private async getAllMessagesForChat(creator: string, chatId: string, fromDate: Date, cookieString: string): Promise<any[]> {
        const stopWhen = (items: any[]) => {
            const last = items[items.length - 1];
            if (!last || !last.datetime) return false;
            const d = new Date(last.datetime);
            return Number.isNaN(d.getTime()) || d < fromDate;
        };
        const headers = this.headersFor(cookieString, creator);
        headers["X-Mark-Read"] = "false";
        return this.fetchAllPages(
            `${BASE}/api/chats/${chatId}/messages/?read=false`,
            headers,
            `msgs:${creator}:${chatId}`,
            stopWhen
        );
    }

    /**
     * Filters messages for unlock events within a date range.
     * @param messages Message list.
     * @param fromDate Start date.
     * @param toDate End date.
     */
    private pickUnlocksInWindow(messages: any[], fromDate: Date, toDate: Date): {datetime: string, price: number}[] {
        return messages
            .filter(m =>
                m.unlock &&
                typeof m.unlock.price !== "undefined" &&
                m.unlocked &&
                new Date(m.datetime) >= fromDate &&
                new Date(m.datetime) <= toDate
            )
            .map(m => ({ datetime: m.unlocked, price: Number(m.unlock.price) || 0 }));
    }

    /**
     * Syncs unlock earnings from the last 24 hours.
     */
    public async syncLast24Hours(): Promise<void> {
        const cookieString = await this.requireCookies();
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const models = await this.modelRepo.findAll();
        console.log(`F2F: Found ${models.length} models, syncing unlocks from ${from.toISOString()} to ${now.toISOString()}`);
        for (const model of models) {
            const creator = model.username;
            const chatter = await this.chatterRepo.findByEmail('womabusiness@outlook.com');
            console.log(`F2F: Processing model ${creator}, chatter ${chatter ? chatter.id : "NOT FOUND"}`);
            const chats = await this.getAllChatsForCreator(creator, from, now, cookieString);
            console.log(`F2F: Found ${chats.length} chats with activity for ${creator}`);
            for (const chat of chats) {
                const msgs = await this.getAllMessagesForChat(creator, chat.id, from, cookieString);
                console.log(`F2F: Chat ${chat.id} has ${msgs.length} messages`);
                const unlocks = this.pickUnlocksInWindow(msgs, from, now);
                console.log(`F2F: Chat ${chat.id} has ${unlocks.length} unlocks in window`);
                for (const u of unlocks) {
                    const ts = new Date(u.datetime);
                    const shift = await this.shiftRepo.findShiftForChatterAt(chatter!.id, ts);
                    console.log(`F2F: Logging earning for unlock in chat ${chat.id} at ${u.datetime} for $${u.price}`);
                    await this.earningRepo.create({
                        companyId: this.companyId,
                        chatterId: chatter?.id || 0,
                        modelId: model.id,
                        shiftId: shift?.id ?? null,
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
