export interface IEarningTypeRepository {
    listActive(): Promise<{ id: number; code: string; label: string | null }[]>;
}
