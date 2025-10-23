import {describe, it, expect} from "@jest/globals";
import {ShiftRequestModel} from "../ShiftRequestModel";

describe("ShiftRequestModel", () => {
    const baseRow = {
        id: 1,
        shift_id: 10,
        chatter_id: 20,
        type: "cancel",
        status: "pending",
        note: "Need to cancel",
        manager_note: "Respond ASAP",
        created_at: new Date("2024-01-01T10:00:00.000Z"),
        updated_at: new Date("2024-01-01T11:00:00.000Z"),
        resolved_at: null,
        shift_date: new Date("2024-01-02"),
        shift_start_time: "10:00",
        shift_end_time: "18:00",
    } as const;

    it("includes chatterName and chatter.full_name in the JSON payload", () => {
        const row = {
            ...baseRow,
            chatter_name: "Alice Example",
        } as any;
        const model = ShiftRequestModel.fromRow(row);
        const json = model.toJSON() as any;

        expect(json.managerNote).toBe("Respond ASAP");
        expect(json.chatterName).toBe("Alice Example");
        expect(json.chatter).toEqual({
            id: 20,
            name: "Alice Example",
            fullName: "Alice Example",
            full_name: "Alice Example",
        });
    });

    it("falls back to a generated chatter name when none is available", () => {
        const row = {
            ...baseRow,
            chatter_id: 99,
            chatter_name: null,
        } as any;
        const model = ShiftRequestModel.fromRow(row);
        const json = model.toJSON() as any;

        expect(json.chatterName).toBe("Chatter 99");
        expect(json.chatter.full_name).toBe("Chatter 99");
    });
});
