/**
 * ChatterLeaderboardModel module.
 */
/**
 * ChatterLeaderboardModel class.
 */
export class ChatterLeaderboardModel {
    constructor(
        private _chatterId: number,
        private _chatterName: string,
        private _weeklyAmount: number,
        private _monthlyAmount: number,
        private _rank: number,
    ) {}

    public toJSON(): Record<string, any> {
        return {
            chatterId: this.chatterId,
            chatterName: this.chatterName,
            weeklyAmount: this.weeklyAmount,
            monthlyAmount: this.monthlyAmount,
            rank: this.rank,
        };
    }

    get chatterId(): number { return this._chatterId; }
    get chatterName(): string { return this._chatterName; }
    get weeklyAmount(): number { return this._weeklyAmount; }
    get monthlyAmount(): number { return this._monthlyAmount; }
    get rank(): number { return this._rank; }
}
