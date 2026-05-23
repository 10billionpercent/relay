export interface IDatabaseWrapper {
  prepare(sql: string): IStatementWrapper;
  exec(sql: string): Promise<void>;
  transaction<T extends unknown[]>(
    fn: (db: IDatabaseWrapper, ...args: T) => void,
  ): (...args: T) => void;
  close(): void;
}

export interface IStatementWrapper {
  all(...params: unknown[]): Promise<Record<string, unknown>[]>;
  get(...params: unknown[]): Promise<Record<string, unknown> | undefined>;
  run(
    ...params: unknown[]
  ): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  free(): void;
}
