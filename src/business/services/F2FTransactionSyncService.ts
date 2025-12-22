/**
 * F2FTransactionSyncService module.
 */
import {inject, injectable} from "tsyringe";
import {IShiftRepository} from "../../data/interfaces/IShiftRepository";
import {IEmployeeEarningRepository} from "../../data/interfaces/IEmployeeEarningRepository";
import {IModelRepository} from "../../data/interfaces/IModelRepository";
import {IF2FCookieSettingRepository} from "../../data/interfaces/IF2FCookieSettingRepository";
import { ICompanyRepository } from "../../data/interfaces/ICompanyRepository";
import { resolveCompanyId } from "../../config/bonus";
import { BUSINESS_TIMEZONE, formatDateInZone, parseDateAssumingZone } from "../../utils/Time";
import { F2FCookieEntry } from "../../data/models/F2FCookieSetting";
import { ShiftBuyerRelationship } from "../../rename/types";
import { load as loadHtml } from "cheerio";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA = process.env.UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const F2F_MODEL_TIMEZONE = process.env.F2F_MODEL_TIMEZONE || "Europe/Amsterdam";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const MONTH_INDEX: Record<string, number> = {
    jan: 0, january: 0, januari: 0,
    feb: 1, february: 1, februari: 1,
    mar: 2, march: 2, maart: 2,
    apr: 3, april: 3,
    may: 4, mei: 4,
    jun: 5, june: 5, juni: 5,
    jul: 6, july: 6, juli: 6,
    aug: 7, august: 7, augustus: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, oktober: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
};

/**
 * Service that syncs recent transactions from F2F.
 */
@injectable()
/**
 * F2FTransactionSyncService class.
 */
export class F2FTransactionSyncService {
    private lastSeenUuid: string | null = null;
    // Prevent overlapping syncs; share the same in-flight promise across callers.
    private inFlight: Promise<number> | null = null;
    private cookieEntries: F2FCookieEntry[] | null = null;
    private lastSyncAt: number | null = null;
    private readonly minSyncIntervalMs = Number(process.env.F2F_SYNC_MIN_INTERVAL_MS ?? 5 * 60 * 1000); // 5 minutes default

    constructor(
        @inject("IShiftRepository") private shiftRepo: IShiftRepository,
        @inject("IEmployeeEarningRepository") private earningRepo: IEmployeeEarningRepository,
        @inject("IModelRepository") private modelRepo: IModelRepository,
        @inject("IF2FCookieSettingRepository") private cookieRepo: IF2FCookieSettingRepository,
        @inject("ICompanyRepository") private companyRepo: ICompanyRepository,
    ) {}

    private readonly companyId = resolveCompanyId();
    private companyTimezone: string | null = null;

    private async getCompanyTimezone(): Promise<string> {
        if (this.companyTimezone) return this.companyTimezone;
        const company = await this.companyRepo.findById(this.companyId);
        this.companyTimezone = company?.timezone ?? BUSINESS_TIMEZONE;
        return this.companyTimezone;
    }

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

    private getCookieValue(raw: string, name: string): string | null {
        const parts = raw.split(";").map(p => p.trim());
        const target = name.toLowerCase();
        for (const part of parts) {
            const [k, ...rest] = part.split("=");
            if (k && k.toLowerCase() === target) {
                return rest.join("=");
            }
        }
        return null;
    }

    private buildModelHeaders(cookieString: string, csrfToken?: string | null): Record<string, string> {
        return {
            accept: "*/*",
            "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
            "content-type": "application/json",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "cors",
            "sec-fetch-dest": "empty",
            "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-ch-ua-mobile": "?0",
            "user-agent": UA,
            cookie: cookieString,
            origin: BASE,
            referer: `${BASE}/accounts/earnings/`,
            ...(csrfToken ? {"x-csrftoken": csrfToken} : {}),
        };
    }

    private splitCookies(raw: string): string[] {
        return String(raw ?? "")
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    private sanitizeModelCookieString(raw: string): string {
        // Some model endpoints don't require csrftoken in the cookie; remove it to avoid CSRF mismatches.
        return raw
            .split(";")
            .map(part => part.trim())
            .filter(part => !!part && !/^csrftoken=/i.test(part))
            .join("; ");
    }

    private async loadCookieEntries(): Promise<F2FCookieEntry[]> {
        if (this.cookieEntries) {
            return this.cookieEntries;
        }
        const record = await this.cookieRepo.getF2FCookies({ companyId: this.companyId });
        const rawEntries = record?.entries ?? [];
        const entries: F2FCookieEntry[] = rawEntries.length
            ? rawEntries.map(e => ({
                ...e,
                type: e.type === "model" ? "model" as const : "creator" as const,
            }))
            : this.splitCookies(record?.cookies ?? "").map(cookies => ({ type: "creator" as const, cookies }));
        if (!entries.length) {
            throw new Error("F2F cookies not configured");
        }
        this.cookieEntries = entries;
        return entries;
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
    private getMonthStart(timezone: string): Date {
        const now = new Date();
        const monthStartStr = formatDateInZone(now, timezone, "yyyy-MM-01'T'00:00:00");
        return parseDateAssumingZone(monthStartStr, timezone);
    }

    private async fetchTransactions(cookieString: string, cutoffOverride?: Date): Promise<any[]> {
        const start = Date.now();
        console.log(`[F2F][Creator] fetchTransactions start at ${new Date(start).toISOString()}`);
        const timezone = await this.getCompanyTimezone();
        const defaultCutoff = new Date();
        defaultCutoff.setUTCHours(0, 0, 0, 0);
        defaultCutoff.setUTCDate(defaultCutoff.getUTCDate() - 45);
        const cutoff = cutoffOverride ?? this.getMonthStart(timezone) ?? defaultCutoff;

        let url: string | null = `${BASE}/api/agency/transactions/`;
        const all: any[] = [];
        const seenPages = new Set<string>();

        while (url) {
            const pageStart = Date.now();
            console.log(`[F2F][Creator] Fetching page ${seenPages.size + 1} url=${url}`);
            if (seenPages.has(url)) {
                console.warn(`Transactions page ${url} already processed, stopping pagination`);
                break;
            }
            seenPages.add(url);

            const {results, next} = await this.fetchTransactionsPage(url, cookieString);
            console.log(`[F2F][Creator] Page ${seenPages.size} returned ${results.length} results in ${(Date.now() - pageStart)}ms, next=${next}`);
            all.push(...results);

            const seenLast = this.lastSeenUuid && results.some((t: any) => t.uuid === this.lastSeenUuid);
            const last = results[results.length - 1];
            const tooOld = last ? new Date(last.created) < cutoff : false;
            if (seenLast || tooOld) break;

            url = next;
        }

        const filtered = all.filter(t => new Date(t.created) >= cutoff);
        console.log(`[F2F][Creator] fetchTransactions done in ${(Date.now() - start)}ms; kept ${filtered.length} of ${all.length}`);
        return filtered;
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
        const data = JSON.parse(text);
        return data;
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

        return objectType;
    }

    private parseEuroAmount(input?: string | null): number {
        const cleaned = String(input ?? "")
            .replace(/[^\d,.,-]/g, "")
            .replace(/\./g, "")
            .replace(",", ".");
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private parseModelDate(dateText: string | null, timeText: string | null, timezone: string): Date | null {
        if (!dateText) return null;
        const cleaned = dateText.replace(",", " ").trim().toLowerCase();
        const parts = cleaned.split(/\s+/).filter(Boolean);
        if (parts.length < 3) return null;

        const day = Number(parts[0]);
        const monthIdx = MONTH_INDEX[parts[1]] ?? MONTH_INDEX[parts[1].slice(0, 3)];
        const year = Number(parts[2]);
        if (!Number.isFinite(day) || !Number.isFinite(year) || monthIdx === undefined) return null;

        const time = (timeText || "00:00").trim();
        const iso = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}`;
        try {
            return parseDateAssumingZone(iso, timezone);
        } catch {
            return null;
        }
    }

    private findRowValue($: ReturnType<typeof loadHtml>, label: string): string | null {
        const lowerLabel = label.toLowerCase();
        const row = $(".row").filter((_, el) => {
            const first = $(el).find("span").first().text().trim().toLowerCase();
            return first === lowerLabel;
        }).first();
        if (!row.length) return null;
        const value = row.find("span").eq(1).text().trim();
        return value || null;
    }

    private async createEarningForTransaction(
        txn: any,
        modelMap: Map<string, number>,
        cookieString: string,
        entry: F2FCookieEntry
    ): Promise<boolean> {
        const id = txn.uuid;
        if (!id) return false;

        const existing = await this.earningRepo.findById(id);
        if (existing) {
            if (existing.manuallyEdited) {
                console.log(`[F2F] Earning ${id} already exists and is manually edited; skipping overwrite`);
            }
            return false;
        }

        const detail = await this.fetchTransactionDetail(id, cookieString);
        console.log(`Processing txn ${id} for user ${detail.user}, revenue ${detail.revenue}`);
        console.log(` -> created ${detail.created}`);

        const revenue = Number(detail.revenue || 0);
        const creator = detail.creator || txn.creator;
        const model = creator ? modelMap.get(creator) : undefined;
        console.log(` -> creator ${creator} maps to model id ${model}`);
        if (!model) return false;

        const timezone = F2F_MODEL_TIMEZONE;
        // Convert to business-local wall-time for shift detection
        const createdUtc = parseDateAssumingZone(detail.created, timezone);
        const timeStr = formatDateInZone(createdUtc, timezone, "HH:mm:ss");

        let chatterId: number | null = null;
        let shiftId: number | null = null;
        console.log(`  -> transaction type: ${txn.object_type}`);
        if (txn.object_type === "paypermessage" || txn.object_type === "tip") {
            const shift = await this.shiftRepo.findShiftForModelAt(model, createdUtc);
            console.log(
                `[SHIFT LOOKUP] model=${creator} at=${createdUtc.toISOString()} shift=${shift?.id ?? "NONE"}`
            );
            console.log(`  -> model ${creator} id ${model}, found shift: ${shift ? shift.id + ' models:' + shift.modelIds.join(',') : 'NO SHIFT'}`);
            chatterId = shift ? shift.chatterId : null;
            shiftId = shift ? shift.id : null;
        }

        const type = this.determineType(txn, detail);
        if (!this.isTypeAllowed(entry, type)) {
            console.log(`[F2F][Creator] Skipping txn ${id} because type ${type} not allowed for this cookie`);
            return false;
        }
        await this.earningRepo.create({
            companyId: this.companyId,
            id,
            chatterId,
            modelId: model ?? null,
            shiftId,
            date: createdUtc,
            amount: revenue,
            description: `F2F: -User: ${detail.user} - Time: ${timeStr}`,
            type,
        });

        return true;
    }

    private parseModelTransactionsList(html: string): { id: string; url: string; type?: string }[] {
        const $ = loadHtml(html);
        const items: { id: string; url: string; type?: string }[] = [];
        $(".transaction").each((_, el) => {
            const url = $(el).attr("data-url") || "";
            const id = url.split("/").filter(Boolean).pop() || "";
            const desc = $(el).find(".description").first();
            const type = (desc.attr("class") || "")
                .split(/\s+/)
                .filter(cls => cls && cls !== "description")
                .shift();
            if (id && url) {
                items.push({ id, url, type });
            }
        });
        return items;
    }

    private async fetchModelTransactionsPage(
        page: number,
        cookieString: string,
        params?: { dateFrom?: string; dateTo?: string }
    ): Promise<{ items: { id: string; url: string; type?: string }[]; nextPage: number | null }> {
        const pageParam = page > 1 ? `&page=${page}` : "";
        const dateFrom = params?.dateFrom ? `&date_from=${encodeURIComponent(params.dateFrom)}` : "&date_from=";
        const dateTo = params?.dateTo ? `&date_to=${encodeURIComponent(params.dateTo)}` : "&date_to=";
        // Endpoint returns JSON with data.html (transaction rows). Page param is optional for the first page.
        const url = `${BASE}/accounts/earnings/transactions/p/?pending=false&types=&users=${dateFrom}${dateTo}${pageParam}`;
        const csrfToken = this.getCookieValue(cookieString, "csrftoken");
        const started = Date.now();
        console.log(`[F2F][Model] Fetching page ${page} url=${url}`);
        const res = await fetch(url, { headers: this.buildModelHeaders(cookieString, csrfToken) });
        const text = await res.text();
        console.log(`[F2F][Model] page ${page} status ${res.status}; content-type=${res.headers.get("content-type")}; duration=${Date.now() - started}ms`);
        const ct = res.headers.get("content-type") || "";
        const looksLikeHtml = ct.includes("text/html") || text.trim().startsWith("<!DOCTYPE");
        if (looksLikeHtml) {
            const items = this.parseModelTransactionsList(text);
            // Try to infer next page from the page markup; the HTML includes a data-url pointing to /p/.
            const hasLoadTrigger = /data-url="[^"]*\/p\//i.test(text);
            const nextPage = hasLoadTrigger ? page + 1 : null;
            return { items, nextPage };
        }
        if (!res.ok) {
            console.warn(`model transactions list returned status ${res.status}; stopping. First 600 chars:\n${text.slice(0, 600)}`);
            return { items: [], nextPage: null };
        }
        let data: any;
        try {
            data = JSON.parse(text);
        } catch (error) {
            const items = this.parseModelTransactionsList(text);
            return { items, nextPage: null };
        }
        const html = data?.data?.html || data?.html || "";
        const paginator = data?.data?.paginator || data?.paginator || {};
        const nextPage = paginator?.has_next ? paginator?.next_page ?? null : null;
        const items = this.parseModelTransactionsList(html);
        return { items, nextPage };
    }

    private parseModelTransactionDetail(html: string, timezone: string): {
        amount: number;
        created: Date;
        buyer?: string;
        paymentType?: string;
        buyerProfilePath?: string;
        buyerRelationship?: "fan" | "follower";
        buyerUsername?: string;
    } | null {
        const $ = loadHtml(html);
        const buyerFromDisplay = $(".profile-title .display-name").text().trim() || undefined;
        const buyerUsername = $(".profile-title .username").text().replace(/^@/, "").trim() || undefined;
        const buyer = buyerFromDisplay || buyerUsername;

        const dateText = this.findRowValue($, "Datum") || this.findRowValue($, "Date");
        const timeText = this.findRowValue($, "Tijd") || this.findRowValue($, "Time");
        const paymentType = this.findRowValue($, "Type") || undefined;

        const netto = this.findRowValue($, "Netto");
        const revenue = this.findRowValue($, "Revenue");
        const gross = this.findRowValue($, "Bedrag");

        const candidates = [netto, revenue, gross]
            .map(v => this.parseEuroAmount(v));
        const amount = candidates.find(v => v > 0) ?? candidates.find(v => v !== 0) ?? 0;
        const created = this.parseModelDate(dateText, timeText, timezone);
        const buyerProfilePath = $("a[href*='/accounts/users/']").first().attr("href") ?? undefined;
        const buyerRelationship = this.parseBuyerRelationship(html);
        if (!created) return null;
        return { amount, created, buyer, paymentType, buyerProfilePath, buyerRelationship, buyerUsername };
    }

    private async fetchModelTransactionDetail(path: string, cookieString: string, timezone: string): Promise<{
        amount: number;
        created: Date;
        buyer?: string;
        paymentType?: string;
        buyerProfilePath?: string;
        buyerRelationship?: "fan" | "follower";
        buyerUsername?: string;
    } | null> {
        const url = path.startsWith("http") ? path : `${BASE}${path}`;
        const csrfToken = this.getCookieValue(cookieString, "csrftoken");
        const res = await fetch(url, { headers: this.buildModelHeaders(cookieString, csrfToken) });
        const text = await res.text();
        const ct = res.headers.get("content-type") || "";
        const looksLikeHtml = ct.includes("text/html") || text.trim().startsWith("<!DOCTYPE");
        if (!res.ok) {
            console.warn(`model transaction ${path} returned status ${res.status}; skipping. First 300 chars:\n${text.slice(0, 300)}`);
            return null;
        }
        let data: any;
        if (!looksLikeHtml) {
            try {
                data = JSON.parse(text);
            } catch (error) {
                // fall back to HTML parsing
            }
        }
        const html = looksLikeHtml ? text : (data?.html || data?.data?.html || "");
        if (!html) return null;
        return this.parseModelTransactionDetail(html, timezone);
    }

    private isTypeAllowed(entry: F2FCookieEntry, type?: string | null): boolean {
        const allowed = entry.allowedEarningTypes;
        if (!allowed || !allowed.length) return true;
        const normalized = (type ?? "").toLowerCase().trim();
        if (!normalized) return true;
        if (allowed.includes(normalized)) return true;
        // Allow a base subscriptionperiod to cover all subscriptionperiod_X variants.
        if (normalized.startsWith("subscriptionperiod") && allowed.includes("subscriptionperiod")) {
            return true;
        }
        return false;
    }

    private normalizeModelTransactionType(paymentType?: string | null, fallback?: string): string | undefined {
        const raw = (paymentType ?? "").toLowerCase().replace(/\s+/g, " ").trim();
        if (raw.includes("ontgrendeld bericht")) return "paypermessage";
        if (raw.includes("verlengde fan") || raw.includes("fan")) {
            const periodMatch = raw.match(/(\d+)/);
            const months = periodMatch ? periodMatch[1] : "1";
            return `subscriptionperiod_${months}`;
        }
        return raw || fallback;
    }

    private normalizeAllowedUserRelationships(entry: F2FCookieEntry): ("fan" | "follower")[] | null {
        const rels = entry.allowedUserRelationships;
        if (!rels || !rels.length) return null;
        const normalized = Array.from(
            new Set(
                rels
                    .map(r => (typeof r === "string" ? r.toLowerCase().trim() : ""))
                    .filter((r): r is "fan" | "follower" => r === "fan" || r === "follower")
            )
        );
        if (!normalized.length || normalized.length === 2) return null;
        return normalized;
    }

    private buildUserApiUrl(profilePath?: string, buyerUsername?: string): string | null {
        const slug =
            (buyerUsername && buyerUsername.trim()) ||
            (profilePath
                ? (profilePath.match(/(user-[a-z0-9-]+)/i)?.[1] ?? profilePath.split("/").filter(Boolean).pop())
                : null);
        if (!slug) return null;
        return `${BASE}/api/users/${slug}/`;
    }

    private isBuyerRelationshipAllowed(
        shiftRel: ShiftBuyerRelationship | null | undefined,
        buyerRel: "fan" | "follower" | undefined
    ): boolean {
        if (!shiftRel || shiftRel === "both") return true;
        if (!buyerRel) return false;
        return shiftRel === buyerRel;
    }

    private parseBuyerRelationship(html: string): "fan" | "follower" | undefined {
        const $ = loadHtml(html);
        const badgeText = $(".badge, .tag, .label, .pill, .status").text().toLowerCase();
        const profileText = $(".profile-title").text().toLowerCase();
        const tabsText = $(".tabs-wrapper").text().toLowerCase();
        const bodyText = $("body").text().toLowerCase();
        const haystack = `${badgeText} ${profileText} ${tabsText} ${bodyText}`;
        if (/\bfan\b/.test(haystack)) return "fan";
        if (/\bfollower\b/.test(haystack) || /\bvolger\b/.test(haystack)) return "follower";
        return undefined;
    }

    private async fetchBuyerRelationship(
        profilePath: string | undefined,
        cookieString: string,
        buyerUsername?: string
    ): Promise<"fan" | "follower" | undefined> {
        const apiUrl = this.buildUserApiUrl(profilePath, buyerUsername);
        const csrfToken = this.getCookieValue(cookieString, "csrftoken");

        if (apiUrl) {
            try {
                const res = await fetch(apiUrl, { headers: this.buildModelHeaders(cookieString, csrfToken) });
                const text = await res.text();
                if (!res.ok) {
                    console.warn(`[F2F][Model] Buyer API ${apiUrl} returned status ${res.status}`);
                } else {
                    try {
                        const data = JSON.parse(text);
                        const relationship = data?.subscription_info ? "fan" : "follower";
                        console.log(`[F2F][Model] Buyer API ${apiUrl} -> ${relationship}`);
                        return relationship;
                    } catch (error) {
                        console.warn(`[F2F][Model] Buyer API ${apiUrl} parse error`, error);
                    }
                }
            } catch (error) {
                console.warn(`[F2F][Model] Buyer API ${apiUrl} request failed`, error);
            }
        }

        if (!profilePath) return undefined;
        const url = profilePath.startsWith("http") ? profilePath : `${BASE}${profilePath}`;
        const res = await fetch(url, { headers: this.buildModelHeaders(cookieString, csrfToken) });
        const text = await res.text();
        if (!res.ok) {
            console.warn(`[F2F][Model] Buyer profile ${profilePath} returned status ${res.status}`);
            return undefined;
        }
        const relationship = this.parseBuyerRelationship(text);
        if (relationship) {
            console.log(`[F2F][Model] Buyer profile ${profilePath} -> ${relationship}`);
        }
        return relationship;
    }

    private async syncModelTransactions(entry: F2FCookieEntry, modelMap: Map<string, number>, fullRefresh: boolean): Promise<number> {
        const modelUsername = entry.modelUsername;
        const rawModelId = entry.modelId;
        const modelId = typeof rawModelId === "number"
            ? rawModelId
            : rawModelId !== undefined
                ? Number(rawModelId)
                : modelUsername
                    ? modelMap.get(modelUsername)
                    : undefined;
        if (!modelId) {
            console.warn(`[F2F] Model cookie entry missing model link (modelId/modelUsername). Entry=${entry.label ?? entry.id ?? "(no label)"}, username=${modelUsername ?? "n/a"}. Skipping.`);
            return 0;
        }
        const modelLabel = modelUsername ?? String(modelId);
        const modelCookies = entry.cookies;
        console.log(`[F2F][Model] Starting sync for ${modelLabel} (id=${modelId})`);

        const timezone = F2F_MODEL_TIMEZONE;
        const cutoff = this.getMonthStart(timezone);
        const allowedRelationships = this.normalizeAllowedUserRelationships(entry);
        let page = 1;
        let created = 0;
        let shouldStop = false;

        while (true) {
            console.log(`[F2F][Model] Fetching page ${page} for ${modelLabel}`);
            const { items, nextPage } = await this.fetchModelTransactionsPage(page, modelCookies);
            console.log(`[F2F][Model] Page ${page} returned ${items.length} items; nextPage=${nextPage}`);
            if (!items.length) break;

            for (const item of items) {
                console.log(`[F2F][Model] Fetching detail for item ${item.id} (${item.type ?? "unknown"})`);
                const detail = await this.fetchModelTransactionDetail(item.url, modelCookies, timezone);
                if (!detail) {
                    console.warn(`[F2F][Model] No detail parsed for item ${item.id}; skipping`);
                    continue;
                }
                let buyerRelationship = detail.buyerRelationship;

                if (detail.created < cutoff) {
                    console.log(`[F2F][Model] Item ${item.id} is before cutoff (${detail.created.toISOString()}), stopping`);
                    shouldStop = true;
                    break;
                }

                const earningId = `model:${modelLabel}:${item.id}`;
                const existing = await this.earningRepo.findById(earningId);
                if (existing && !fullRefresh) {
                    console.log(`[F2F][Model] Earning ${earningId} already exists, stopping further processing`);
                    shouldStop = true;
                    break;
                }

                let chatterId: number | null = null;
                let shiftId: number | null = null;
                if (item.type === "paypermessage" || item.type === "tip") {
                    const shift = await this.shiftRepo.findShiftForModelAt(modelId, detail.created);
                    chatterId = shift ? shift.chatterId : null;
                    shiftId = shift ? shift.id : null;
                    console.log(`[F2F][Model] Shift lookup for ${modelLabel} at ${detail.created.toISOString()} -> shift=${shiftId ?? "none"} chatter=${chatterId ?? "none"}`);
                    const shiftRel = shift?.getBuyerRelationshipForModel(modelId);
                    if (shift && shiftRel && shiftRel !== "both") {
                        if (!buyerRelationship) {
                            buyerRelationship = await this.fetchBuyerRelationship(detail.buyerProfilePath, modelCookies, detail.buyerUsername);
                        }
                        if (!this.isBuyerRelationshipAllowed(shiftRel, buyerRelationship)) {
                            console.log(`[F2F][Model] Shift ${shift.id} requires ${shiftRel} but buyer is ${buyerRelationship ?? "unknown"}; clearing shift match`);
                            chatterId = null;
                            shiftId = null;
                        }
                    }
                }

                const timeStr = formatDateInZone(detail.created, timezone, "HH:mm:ss");
                const txnType = this.normalizeModelTransactionType(detail.paymentType, item.type);
                if (!this.isTypeAllowed(entry, txnType)) {
                    console.log(`[F2F][Model] Skipping earning for ${item.id} because type ${txnType} not allowed`);
                    continue;
                }
                if (allowedRelationships) {
                    if (!buyerRelationship) {
                        buyerRelationship = await this.fetchBuyerRelationship(detail.buyerProfilePath, modelCookies, detail.buyerUsername);
                    }
                    if (!buyerRelationship) {
                        console.log(`[F2F][Model] Skipping ${item.id}; buyer relationship unknown but filter=${allowedRelationships.join(",")}`);
                        continue;
                    }
                    if (!allowedRelationships.includes(buyerRelationship)) {
                        console.log(`[F2F][Model] Skipping ${item.id}; buyer is ${buyerRelationship} but filter=${allowedRelationships.join(",")}`);
                        continue;
                    }
                }
                await this.earningRepo.create({
                    companyId: this.companyId,
                    id: earningId,
                    chatterId,
                    modelId,
                    shiftId,
                    date: detail.created,
                    amount: detail.amount,
                    description: `F2F: -User: ${detail.buyer ?? "unknown"} - Time: ${timeStr}`,
                    type: txnType,
                });
                console.log(`[F2F][Model] Created earning ${earningId} amount=${detail.amount} type=${txnType}`);
                created++;
                await sleep(100);
            }

            if (shouldStop) break;
            if (!nextPage) break;
            page = nextPage;
            await sleep(150);
        }

        console.log(`[F2F][Model] Sync finished for ${modelLabel}; created=${created}`);
        return created;
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

    private async syncCreatorTransactions(entry: F2FCookieEntry, modelMap: Map<string, number>, fullRefresh: boolean): Promise<number> {
        const started = Date.now();
        console.log(`[F2F][Creator] sync start for ${entry.label ?? entry.id ?? "(no label)"}`);
        const timezone = await this.getCompanyTimezone();
        const monthStart = this.getMonthStart(timezone);
        const list = await this.fetchTransactions(entry.cookies, monthStart);
        if (!list.length) return 0;

        let newTxns = list;
        if (!fullRefresh && this.lastSeenUuid) {
            const idx = list.findIndex((t: any) => t.uuid === this.lastSeenUuid);
            if (idx >= 0) newTxns = list.slice(0, idx);
        }
        if (!newTxns.length) return 0;

        // process oldest first
        let created = 0;
        for (const txn of newTxns.reverse()) {
            if (txn.uuid === this.lastSeenUuid) break;
            const initialType = txn?.object_type;
            if (!this.isTypeAllowed(entry, initialType)) {
                console.log(`[F2F][Creator] Skipping txn ${txn.uuid} because type ${initialType} not allowed for this cookie`);
                continue;
            }
            const didCreate = await this.createEarningForTransaction(txn, modelMap, entry.cookies, entry);
            if (didCreate) {
                created++;
            }
        }

        console.log(`[F2F][Creator] sync finished for ${entry.label ?? entry.id ?? "(no label)"} created=${created} duration=${Date.now() - started}ms`);
        return created;
    }

    /**
     * Syncs recent transactions to earnings.
     * @returns Number of new earnings created during the sync.
     */
    public async syncRecentTransactions(options: { fullRefresh?: boolean } = {}): Promise<number> {
        const now = Date.now();
        console.log(`[F2F] syncRecentTransactions called at ${new Date(now).toISOString()}`);
        if (this.lastSyncAt && now - this.lastSyncAt < this.minSyncIntervalMs) {
            console.log(`[F2F] Skipping sync; last run ${(now - this.lastSyncAt) / 1000}s ago`);
            return 0;
        }
        if (this.inFlight) {
            console.log("[F2F] Returning existing in-flight sync promise");
            return this.inFlight;
        }
        console.log("[F2F] Starting new sync");
        this.inFlight = this.syncRecentTransactionsInternal(options).finally(() => {
            this.inFlight = null;
        });
        return this.inFlight;
    }

    private async syncRecentTransactionsInternal(options: { fullRefresh?: boolean } = {}): Promise<number> {
        console.log("[F2F] syncRecentTransactionsInternal: fetching lastSeenUuid and cookie entries");
        // Use creator-only last id so we can stop pagination early for agency transactions,
        // unless a full refresh is requested (e.g. /sync endpoint).
        this.lastSeenUuid = options.fullRefresh ? null : await this.earningRepo.getLastCreatorId();
        const entries = await this.loadCookieEntries();
        console.log(`[F2F] Loaded ${entries.length} cookie entries`);
        const creatorEntries = entries.filter(e => e.type === "creator");
        const modelEntries = entries.filter(e => e.type === "model");
        console.log(`[F2F] creator entries: ${creatorEntries.length}, model entries: ${modelEntries.length}`);
        const modelMap = await this.buildModelMap();
        console.log(`[F2F] model map size: ${modelMap.size}`);

        let created = 0;
        for (const entry of creatorEntries) {
            console.log(`[F2F] Syncing creator entry ${entry.label ?? entry.id ?? "(no label)"}`);
            created += await this.syncCreatorTransactions(entry, modelMap, options.fullRefresh === true);
        }

        for (const entry of modelEntries) {
            console.log(`[F2F] Syncing model entry ${entry.label ?? entry.id ?? "(no label)"}`);
            created += await this.syncModelTransactions(entry, modelMap, options.fullRefresh === true);
        }

        this.lastSyncAt = Date.now();
        return created;
    }

    public async syncTransactionsBetween(from: Date, to: Date): Promise<number> {
        if (from > to) return 0;

        const entries = await this.loadCookieEntries();
        const creatorEntries = entries.filter(e => e.type === "creator");
        const modelEntries = entries.filter(e => e.type === "model");
        if (!creatorEntries.length && !modelEntries.length) return 0;

        const modelMap = await this.buildModelMap();
        let created = 0;

        for (const entry of creatorEntries) {
            const txns = await this.fetchTransactionsBetween(from, to, entry.cookies);
            if (!txns.length) continue;

            txns.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

            for (const txn of txns) {
                const initialType = txn?.object_type;
                if (!this.isTypeAllowed(entry, initialType)) {
                    console.log(`[F2F][Creator] Skipping txn ${txn.uuid} because type ${initialType} not allowed for this cookie`);
                    continue;
                }
                const didCreate = await this.createEarningForTransaction(txn, modelMap, entry.cookies, entry);
                if (didCreate) created++;
                await sleep(100);
            }
        }

        for (const entry of modelEntries) {
            created += await this.syncModelTransactionsBetween(entry, modelMap, from, to);
        }

        return created;
    }

    private async syncModelTransactionsBetween(
        entry: F2FCookieEntry,
        modelMap: Map<string, number>,
        from: Date,
        to: Date
    ): Promise<number> {
        const modelUsername = entry.modelUsername;
        const rawModelId = entry.modelId;
        const modelId = typeof rawModelId === "number"
            ? rawModelId
            : rawModelId !== undefined
                ? Number(rawModelId)
                : modelUsername
                    ? modelMap.get(modelUsername)
                    : undefined;
        if (!modelId) {
            console.warn(`[F2F] Model cookie entry missing model link (modelId/modelUsername). Entry=${entry.label ?? entry.id ?? "(no label)"}, username=${modelUsername ?? "n/a"}. Skipping.`);
            return 0;
        }
        const modelLabel = modelUsername ?? String(modelId);
        const modelCookies = entry.cookies;
        const timezone = F2F_MODEL_TIMEZONE;
        const allowedRelationships = this.normalizeAllowedUserRelationships(entry);

        const dateFromStr = formatDateInZone(from, timezone, "yyyy-MM-dd");
        const dateToStr = formatDateInZone(to, timezone, "yyyy-MM-dd");

        let page = 1;
        let created = 0;
        let shouldStop = false;

        while (true) {
            console.log(`[F2F][Model][Range] Fetching page ${page} for ${modelLabel} (${dateFromStr} to ${dateToStr})`);
            const { items, nextPage } = await this.fetchModelTransactionsPage(page, modelCookies, { dateFrom: dateFromStr, dateTo: dateToStr });
            console.log(`[F2F][Model][Range] Page ${page} returned ${items.length} items; nextPage=${nextPage}`);
            if (!items.length) break;

            for (const item of items) {
                console.log(`[F2F][Model][Range] Fetching detail for item ${item.id} (${item.type ?? "unknown"})`);
                const detail = await this.fetchModelTransactionDetail(item.url, modelCookies, timezone);
                if (!detail) {
                    console.warn(`[F2F][Model][Range] No detail parsed for item ${item.id}; skipping`);
                    continue;
                }
                let buyerRelationship = detail.buyerRelationship;

                if (detail.created < from) {
                    console.log(`[F2F][Model][Range] Item ${item.id} is before from (${detail.created.toISOString()} < ${from.toISOString()}), stopping`);
                    shouldStop = true;
                    break;
                }
                if (detail.created > to) {
                    console.log(`[F2F][Model][Range] Item ${item.id} is after to (${detail.created.toISOString()} > ${to.toISOString()}), skipping`);
                    continue;
                }

                const earningId = `model:${modelLabel}:${item.id}`;
                const existing = await this.earningRepo.findById(earningId);
                if (existing) {
                    console.log(`[F2F][Model][Range] Earning ${earningId} already exists, skipping`);
                    continue;
                }

                let chatterId: number | null = null;
                let shiftId: number | null = null;
                if (item.type === "paypermessage" || item.type === "tip") {
                    const shift = await this.shiftRepo.findShiftForModelAt(modelId, detail.created);
                    chatterId = shift ? shift.chatterId : null;
                    shiftId = shift ? shift.id : null;
                    console.log(`[F2F][Model][Range] Shift lookup for ${modelLabel} at ${detail.created.toISOString()} -> shift=${shiftId ?? "none"} chatter=${chatterId ?? "none"}`);
                    const shiftRel = shift?.getBuyerRelationshipForModel(modelId);
                    if (shift && shiftRel && shiftRel !== "both") {
                        if (!buyerRelationship) {
                            buyerRelationship = await this.fetchBuyerRelationship(detail.buyerProfilePath, modelCookies, detail.buyerUsername);
                        }
                        if (!this.isBuyerRelationshipAllowed(shiftRel, buyerRelationship)) {
                            console.log(`[F2F][Model][Range] Shift ${shift.id} requires ${shiftRel} but buyer is ${buyerRelationship ?? "unknown"}; clearing shift match`);
                            chatterId = null;
                            shiftId = null;
                        }
                    }
                }

                const timeStr = formatDateInZone(detail.created, timezone, "HH:mm:ss");
                const txnType = this.normalizeModelTransactionType(detail.paymentType, item.type);
                if (!this.isTypeAllowed(entry, txnType)) {
                    console.log(`[F2F][Model][Range] Skipping earning for ${item.id} because type ${txnType} not allowed`);
                    continue;
                }
                if (allowedRelationships) {
                    if (!buyerRelationship) {
                        buyerRelationship = await this.fetchBuyerRelationship(detail.buyerProfilePath, modelCookies, detail.buyerUsername);
                    }
                    if (!buyerRelationship) {
                        console.log(`[F2F][Model][Range] Skipping ${item.id}; buyer relationship unknown but filter=${allowedRelationships.join(",")}`);
                        continue;
                    }
                    if (!allowedRelationships.includes(buyerRelationship)) {
                        console.log(`[F2F][Model][Range] Skipping ${item.id}; buyer is ${buyerRelationship} but filter=${allowedRelationships.join(",")}`);
                        continue;
                    }
                }
                await this.earningRepo.create({
                    companyId: this.companyId,
                    id: earningId,
                    chatterId,
                    modelId,
                    shiftId,
                    date: detail.created,
                    amount: detail.amount,
                    description: `F2F: -User: ${detail.buyer ?? "unknown"} - Time: ${timeStr}`,
                    type: txnType,
                });
                console.log(`[F2F][Model][Range] Created earning ${earningId} amount=${detail.amount} type=${txnType}`);
                created++;
                await sleep(100);
            }

            if (shouldStop) break;
            if (!nextPage) break;
            page = nextPage;
            await sleep(150);
        }

        console.log(`[F2F][Model][Range] Sync finished for ${modelLabel}; created=${created}`);
        return created;
    }
}
