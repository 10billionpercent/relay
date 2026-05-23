import initSqlJs, {
  Database as SqlJsDatabase,
  Statement as SqlJsStatement,
  SqlValue,
} from "sql.js";
import fs from "fs";
import path from "path";
import { IDatabaseWrapper, IStatementWrapper } from "./db-interface";

export class DatabaseWrapper implements IDatabaseWrapper {
  private db: SqlJsDatabase;
  private dbPath: string;

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.db, sql, () => this.save());
  }

  async exec(sql: string) {
    this.db.exec(sql);
    this.save();
  }

  transaction<T extends unknown[]>(
    fn: (db: DatabaseWrapper, ...args: T) => void,
  ): (...args: T) => void {
    return (...args: T) => {
      fn(this, ...args);
      this.save();
    };
  }

  close() {
    this.save();
    this.db.close();
  }

  private save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }
}

class StatementWrapper implements IStatementWrapper {
  private stmt: SqlJsStatement;
  private db: SqlJsDatabase;
  private onRun: () => void;

  constructor(db: SqlJsDatabase, sql: string, onRun: () => void) {
    this.db = db;
    this.stmt = db.prepare(sql);
    this.onRun = onRun;
  }

  private bindParams(params?: unknown[]) {
    if (params && params.length > 0) {
      if (params.length === 1 && Array.isArray(params[0])) {
        this.stmt.bind(params[0] as SqlValue[]);
      } else {
        this.stmt.bind(params as SqlValue[]);
      }
    }
  }

  async all(...params: unknown[]): Promise<Record<string, unknown>[]> {
    this.bindParams(params);
    const rows: Record<string, unknown>[] = [];
    while (this.stmt.step()) {
      rows.push(this.stmt.getAsObject() as Record<string, unknown>);
    }
    this.stmt.reset();
    return rows;
  }

  async get(
    ...params: unknown[]
  ): Promise<Record<string, unknown> | undefined> {
    this.bindParams(params);
    if (this.stmt.step()) {
      const row = this.stmt.getAsObject() as Record<string, unknown>;
      this.stmt.reset();
      return row;
    }
    this.stmt.reset();
    return undefined;
  }

  async run(
    ...params: unknown[]
  ): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
    this.bindParams(params);
    while (this.stmt.step()) {}
    this.stmt.reset();
    this.onRun();
    return { changes: 1, lastInsertRowid: 0 };
  }

  free() {
    this.stmt.free();
  }
}

export async function initializeDatabase(
  dbPath?: string,
): Promise<DatabaseWrapper> {
  const DB_PATH =
    dbPath ||
    process.env.DB_PATH ||
    path.join(process.cwd(), "data", "chatbot.db");

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  let sqlDb: SqlJsDatabase;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run("PRAGMA journal_mode=WAL;");

  const wrapper = new DatabaseWrapper(sqlDb, DB_PATH);

  await wrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      token TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      user_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      summary TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS inference_logs (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      conversation_id TEXT NOT NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('success', 'error')),
      error TEXT,
      input_preview TEXT,
      output_preview TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_conversation ON inference_logs(conversation_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON inference_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_model ON inference_logs(model, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_status ON inference_logs(status, timestamp DESC);
  `);

  try {
    await wrapper.exec(
      `ALTER TABLE conversations ADD COLUMN user_id TEXT REFERENCES users(id);`,
    );
  } catch (e) {}

  try {
    await wrapper.exec(`ALTER TABLE messages ADD COLUMN summary TEXT;`);
  } catch (e) {}

  return wrapper;
}
