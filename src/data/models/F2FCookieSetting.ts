export type F2FCookieAccountType = "creator" | "model";

export interface F2FCookieEntry {
    /**
     * Unique id of this cookie row (DB primary key).
     */
    id?: string;
    /**
     * Account type this cookie belongs to.
     * - "creator": existing agency/creator accounts that expose JSON APIs.
     * - "model": direct model login that exposes HTML responses.
     */
    type: F2FCookieAccountType;
    /**
     * Raw cookie header value.
     */
    cookies: string;
    /**
     * Optional human-readable label for identification in the UI.
     */
    label?: string;
    /**
     * When type is "model", link the cookies to the model username in CRM.
     */
    modelUsername?: string;
    /**
     * Optional model id (if you want a hard FK instead of username mapping).
     */
    modelId?: number | string;
    /**
     * Optional earning type ids linked to this account (FKs to earning_types.id).
     */
    allowedEarningTypeIds?: number[];
    /**
     * Optional earning type codes linked to this account (lowercase identifiers, e.g. "tip").
     */
    allowedEarningTypes?: string[];
    /**
     * When type is "model", optionally restrict earnings to buyers that are followers or fans.
     * - undefined/null/[] => allow both followers and fans.
     * - ["fan"] => only include transactions from fans.
     * - ["follower"] => only include transactions from followers.
     */
    allowedUserRelationships?: ("fan" | "follower")[];
    /**
     * Metadata from storage.
     */
    updatedAt?: Date | null;
    updatedById?: string | null;
    updatedByName?: string | null;
}

export interface F2FCookieSettingRecord {
    id: string;
    /**
     * Raw stored cookie payload (legacy string or JSON-encoded array).
     */
    cookies: string;
    /**
     * Parsed cookie entries.
     */
    entries: F2FCookieEntry[];
    updatedAt: Date | null;
    updatedById: string | null;
    updatedByName: string | null;
}
