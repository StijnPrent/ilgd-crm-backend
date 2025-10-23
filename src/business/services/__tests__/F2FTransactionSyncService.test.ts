import {describe, expect, it} from "@jest/globals";
import {F2FTransactionSyncService} from "../F2FTransactionSyncService";

describe("F2FTransactionSyncService determineType", () => {
    const service = new F2FTransactionSyncService({} as any, {} as any, {} as any, {} as any);
    const determineType = (txn: any, detail: any) => (service as any).determineType(txn, detail);

    it("returns the transaction object type when present", () => {
        const type = determineType({object_type: "subscriptionperiod_1"}, {});
        expect(type).toBe("subscriptionperiod_1");
    });

    it("falls back to detail object type when transaction is missing it", () => {
        const type = determineType({}, {object_type: "subscriptionperiod_6"});
        expect(type).toBe("subscriptionperiod_6");
    });

    it("keeps non-subscription types untouched", () => {
        const type = determineType({object_type: "tip"}, {});
        expect(type).toBe("tip");
    });
});
