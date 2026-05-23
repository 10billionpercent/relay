import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";

export class DatabaseWrapper {
  private db: SqlJsDatabase;
  private dbPath: string;

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.db, sql, () => this.save());
  }

  exec(sql: string) {
    const results = this.db.exec(sql);
    this.save();
    return results;
  }

  transaction<T extends any[]>(
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

class StatementWrapper {
  private stmt: any;
  private db: SqlJsDatabase;
  private onRun: () => void;

  constructor(db: SqlJsDatabase, sql: string, onRun: () => void) {
    this.db = db;
    this.stmt = db.prepare(sql);
    this.onRun = onRun;
  }

  private bindParams(params?: any[]) {
    if (params && params.length > 0) {
      if (params.length === 1 && Array.isArray(params[0])) {
        this.stmt.bind(params[0]);
      } else {
        this.stmt.bind(params);
      }
    }
  }

  all(...params: any[]): any[] {
    this.bindParams(params);
    const rows: any[] = [];
    while (this.stmt.step()) {
      rows.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return rows;
  }

  get(...params: any[]): any | undefined {
    this.bindParams(params);
    let row: any = undefined;
    if (this.stmt.step()) {
      row = this.stmt.getAsObject();
    }
    this.stmt.reset();
    return row;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint } {
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

  // Create tables (if not exist)
  wrapper.exec(`
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

  // Migrations: add missing columns if they don't exist (safe to run multiple times)
  try {
    wrapper.exec(
      `ALTER TABLE conversations ADD COLUMN user_id TEXT REFERENCES users(id);`,
    );
  } catch (e) {}

  try {
    wrapper.exec(`ALTER TABLE messages ADD COLUMN summary TEXT;`);
  } catch (e) {}

  return wrapper;
}
