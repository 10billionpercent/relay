import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { IDatabaseWrapper, IStatementWrapper } from "./db-interface";

export class D1DatabaseWrapper implements IDatabaseWrapper {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  prepare(sql: string): D1StatementWrapper {
    return new D1StatementWrapper(this.db.prepare(sql));
  }

  async exec(sql: string) {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await this.db.prepare(stmt).run();
    }
  }

  transaction<T extends unknown[]>(
    fn: (db: D1DatabaseWrapper, ...args: T) => void,
  ): (...args: T) => void {
    return (...args: T) => {
      fn(this, ...args);
    };
  }

  close() {
    // noop
  }
}

class D1StatementWrapper implements IStatementWrapper {
  private stmt: D1PreparedStatement;

  constructor(stmt: D1PreparedStatement) {
    this.stmt = stmt;
  }

  async all(...params: unknown[]): Promise<Record<string, unknown>[]> {
    const bound = params.length > 0 ? this.stmt.bind(...params) : this.stmt;
    const result = await bound.all();
    return (result.results || []) as Record<string, unknown>[];
  }

  async get(
    ...params: unknown[]
  ): Promise<Record<string, unknown> | undefined> {
    const bound = params.length > 0 ? this.stmt.bind(...params) : this.stmt;
    const row = await bound.first();
    return row as Record<string, unknown> | undefined;
  }

  async run(
    ...params: unknown[]
  ): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
    const bound = params.length > 0 ? this.stmt.bind(...params) : this.stmt;
    const result = await bound.run();
    return {
      changes: result.meta?.changes || 1,
      lastInsertRowid: result.meta?.last_row_id || 0,
    };
  }

  free() {
    // noop
  }
}
