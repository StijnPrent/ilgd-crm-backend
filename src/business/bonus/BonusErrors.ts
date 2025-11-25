/**
 * Bonus engine error types.
 */

export class BonusValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BonusValidationError";
    }
}

export class BonusAwardConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BonusAwardConflictError";
    }
}
