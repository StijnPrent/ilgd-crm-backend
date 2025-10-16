import {describe, expect, it} from "@jest/globals";
import {F2FTransactionSyncService} from "../F2FTransactionSyncService";

describe("F2FTransactionSyncService subscription typing", () => {
    const service = new F2FTransactionSyncService({} as any, {} as any, {} as any);
    const determineType = (txn: any, detail: any) => (service as any).determineType(txn, detail);

    it("returns monthly variant when detail reports monthly period", () => {
        const type = determineType({object_type: "subscriptionperiod"}, {subscription_period: "Monthly"});
        expect(type).toBe("subscriptionperiod:monthly");
    });

    it("extracts multi-month duration from product name", () => {
        const type = determineType({object_type: "subscriptionperiod"}, {product: {name: "3 Months Subscription"}});
        expect(type).toBe("subscriptionperiod:3-month");
    });

    it("falls back to generic subscription when variant is missing", () => {
        const type = determineType({object_type: "subscriptionperiod"}, {});
        expect(type).toBe("subscriptionperiod");
    });

    it("keeps non-subscription types untouched", () => {
        const type = determineType({object_type: "tip"}, {});
        expect(type).toBe("tip");
    });
});
