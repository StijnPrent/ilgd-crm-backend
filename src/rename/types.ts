/**
 * types module.
 */
export type Role = "manager" | "chatter";
export type CurrencySymbol = "€";
export type ChatterStatus = "active" | "inactive"; // extend if you add more states
export type ShiftStatus = "scheduled" | "active" | "completed" | "cancelled";
export type CommissionStatus = "pending" | "paid" | "cancelled";
export type ShiftRequestType = "cancel" | "trade";
export type ShiftRequestStatus = "pending" | "approved" | "declined" | "cancelled" | "resolved";
export type ShiftBuyerRelationship = "fan" | "follower" | "both";
