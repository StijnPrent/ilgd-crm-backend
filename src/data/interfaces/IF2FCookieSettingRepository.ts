import { F2FCookieEntry, F2FCookieSettingRecord } from "../models/F2FCookieSetting";

export interface IF2FCookieSettingRepository {
    getF2FCookies(params: { companyId: number }): Promise<F2FCookieSettingRecord | null>;
    updateF2FCookies(params: {
        companyId: number;
        cookies?: string;
        entries?: F2FCookieEntry[];
        userId: string | number | bigint;
    }): Promise<F2FCookieSettingRecord>;
}
