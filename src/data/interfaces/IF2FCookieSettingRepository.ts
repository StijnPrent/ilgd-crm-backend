import { F2FCookieSettingRecord } from "../models/F2FCookieSetting";

export interface IF2FCookieSettingRepository {
    getF2FCookies(params: { companyId: number }): Promise<F2FCookieSettingRecord | null>;
    updateF2FCookies(params: { companyId: number; cookies: string; userId: string | number | bigint }): Promise<F2FCookieSettingRecord>;
}
