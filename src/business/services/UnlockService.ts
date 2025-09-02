import "dotenv/config";
import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {ShiftModel} from "../models/ShiftModel";

const BASE = "https://f2f.com";
const UA =
    process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const COOKIES = process.env.COOKIES || "";

const CREATORS_URL = `${BASE}/api/agency/creators/`;
const CHATS_URL = `${BASE}/api/chats/?ordering=newest-first`;
const CHAT_MESSAGES_URL = (chatId: string) => `${BASE}/api/chats/${chatId}/messages/`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const headersFor = (creatorSlug?: string) => {
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
};

async function fetchAllPages(startUrl: string, headers: Record<string,string>, label = "") {
    let url: string | null = startUrl;
    const all: any[] = [];
    const seen = new Set<string>();

    while (url) {
        if (seen.has(url)) break;
        seen.add(url);

        const res = await fetch(url, { headers });
        const ct = res.headers.get("content-type") || "";
        const text = await res.text();

        if (!res.ok || ct.includes("text/html")) {
            throw new Error(`[${label}] Blocked/error ${res.status}. First 300 chars:\n${text.slice(0,300)}`);
        }
        const page = JSON.parse(text);
        const items = Array.isArray(page) ? page : page.results || [];
        all.push(...items);
        url = page.next || null;

        if (url) await sleep(120);
    }
    return all;
}

async function getAllCreators() {
    const creators = await fetchAllPages(CREATORS_URL, headersFor(), "creators");
    const slugs = creators
        .map((c: any) => c.username || c.slug || c.id || c.name)
        .filter(Boolean);
    return [...new Set(slugs)];
}

async function getAllChatsForCreator(creator: string, fromDate: Date, toDate: Date) {
    const chats = await fetchAllPages(
        CHATS_URL,
        headersFor(creator),
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

async function getAllMessagesForChat(creator: string, chatId: string) {
    return fetchAllPages(CHAT_MESSAGES_URL(chatId), headersFor(creator), `msgs:${creator}:${chatId}`);
}

function pickUnlocksInWindow(messages: any[], fromDate: Date, toDate: Date) {
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

function assignChatter(datetime: string, shifts: ShiftModel[], toDate: Date): number | null {
    const d = new Date(datetime);
    for (const s of shifts) {
        const end = s.endTime ? new Date(s.endTime) : toDate;
        if (d >= new Date(s.startTime) && d <= end) return s.chatterId;
    }
    return null;
}

export interface ChatterTotal { chatterId: number; total: number; }

@injectable()
export class UnlockService {
    constructor(
        @inject("IShiftRepository") private shiftRepo: IShiftRepository
    ) {}

    public async totalsByChatter(from: Date, to: Date): Promise<ChatterTotal[]> {
        if (!COOKIES) throw new Error("Missing COOKIES env variable");

        const creators = await getAllCreators();
        const shifts = await this.shiftRepo.findInRange(from, to);
        const totals: Record<number, number> = {};

        for (const creator of creators) {
            const chats = await getAllChatsForCreator(creator, from, to);
            for (const chat of chats) {
                const msgs = await getAllMessagesForChat(creator, chat.id);
                const unlocks = pickUnlocksInWindow(msgs, from, to);
                for (const u of unlocks) {
                    const chatterId = assignChatter(u.datetime, shifts, to);
                    if (chatterId != null) {
                        totals[chatterId] = (totals[chatterId] || 0) + u.price;
                    }
                }
                await sleep(100);
            }
        }

        return Object.entries(totals).map(([id, total]) => ({ chatterId: Number(id), total }));
    }
}
