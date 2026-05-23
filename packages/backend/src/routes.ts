import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { LoggedLLMClient } from "@relay/sdk";
import type {
  ChatResponse,
  Conversation,
  Message,
  InferenceLog,
  LogBatchRequest,
  User,
  AuthResponse,
} from "@relay/shared";
import { DatabaseWrapper } from "./database.js";
import crypto from "crypto";

declare module "hono" {
  interface ContextVariableMap {
    user: User;
    db: DatabaseWrapper;
  }
}

// Password helpers
function hashPassword(
  password: string,
  salt?: string,
): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 1000, 64, "sha512")
    .toString("hex");
  return { hash, salt: usedSalt };
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const { hash: computedHash } = hashPassword(password, salt);
  return computedHash === hash;
}

const chatSchema = z.object({
  message: z.string().min(1, "Message is required"),
  conversationId: z.string().optional(),
  model: z.string().optional().default("llama-3.1-8b-instant"),
});

const signupSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// Auth middleware
async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.split(" ")[1];
  const user = c
    .get("db")
    .prepare("SELECT * FROM users WHERE token = ?")
    .get(token) as User | undefined;
  if (!user) {
    return c.json({ error: "Invalid token" }, 401);
  }
  c.set("user", user);
  await next();
}

export function createRoutes(db: DatabaseWrapper, llmClient: LoggedLLMClient) {
  const app = new Hono();

  // Inject db into context for middleware access
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  app.use(
    "/*",
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
      ],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Health check
  app.get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: Date.now() });
  });

  // Get available models (public)
  app.get("/api/models", (c) => {
    const models = llmClient.getAvailableModels();
    return c.json(models);
  });

  // ----- Auth routes -----
  // ----- Auth routes -----
  app.post("/api/auth/signup", async (c) => {
    try {
      const body = await c.req.json();
      const { username, password } = signupSchema.parse(body);

      const existing = db
        .prepare("SELECT id FROM users WHERE username = ?")
        .get(username);
      if (existing) {
        return c.json(
          {
            error: "Username already taken. Please log in instead.",
            code: "USERNAME_TAKEN",
          },
          409,
        );
      }

      const id = uuidv4();
      const { hash: passwordHash, salt } = hashPassword(password);
      const storedHash = `${salt}:${passwordHash}`;
      const token = uuidv4();
      const createdAt = Date.now();

      db.prepare(
        "INSERT INTO users (id, username, password_hash, token, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(id, username, storedHash, token, createdAt);

      const response: AuthResponse = {
        token,
        user: { id, username },
      };
      return c.json(response, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Invalid input", details: error.errors }, 400);
      }
      console.error("Signup error:", error);
      return c.json({ error: "Signup failed" }, 500);
    }
  });

  app.post("/api/auth/login", async (c) => {
    try {
      const body = await c.req.json();
      const { username, password } = loginSchema.parse(body);

      const user = db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username) as User | undefined;

      if (!user) {
        return c.json(
          {
            error: "No account found. Please sign up first.",
            code: "USER_NOT_FOUND",
          },
          404,
        );
      }

      const [salt, hash] = user.password_hash.split(":");
      if (!verifyPassword(password, salt, hash)) {
        return c.json({ error: "Incorrect password." }, 401);
      }

      // Generate new token
      const token = uuidv4();
      db.prepare("UPDATE users SET token = ? WHERE id = ?").run(token, user.id);

      const response: AuthResponse = {
        token,
        user: { id: user.id, username: user.username },
      };
      return c.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Invalid input", details: error.errors }, 400);
      }
      console.error("Login error:", error);
      return c.json({ error: "Login failed" }, 500);
    }
  });

  // Get current user
  app.get("/api/auth/me", authMiddleware, (c) => {
    const user = c.get("user") as User;
    return c.json({ id: user.id, username: user.username });
  });

  // ----- Protected routes -----
  app.use("/api/chat", authMiddleware);
  app.use("/api/conversations/*", authMiddleware);
  app.use("/api/ingest/*", authMiddleware);
  app.use("/api/stats", authMiddleware);

  // Chat endpoint
  app.post("/api/chat", async (c) => {
    try {
      const user = c.get("user") as User;
      const body = await c.req.json();
      const validated = chatSchema.parse(body);

      let conversation: Conversation;

      if (validated.conversationId) {
        const existing = db
          .prepare(
            "SELECT * FROM conversations WHERE id = ? AND status = ? AND user_id = ?",
          )
          .get(validated.conversationId, "active", user.id) as
          | Conversation
          | undefined;

        if (!existing) {
          return c.json({ error: "Conversation not found or archived" }, 404);
        }
        conversation = existing;
      } else {
        const id = uuidv4();
        conversation = {
          id,
          title:
            validated.message.substring(0, 50) +
            (validated.message.length > 50 ? "..." : ""),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "active",
          userId: user.id,
        };

        db.prepare(
          "INSERT INTO conversations (id, title, created_at, updated_at, status, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
          conversation.id,
          conversation.title,
          conversation.createdAt,
          conversation.updatedAt,
          conversation.status,
          conversation.userId,
        );
      }

      // Get conversation history
      const history = db
        .prepare(
          "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
        )
        .all(conversation.id) as Message[];

      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        conversationId: conversation.id,
        role: "user",
        content: validated.message,
        timestamp: Date.now(),
      };

      db.prepare(
        "INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
      ).run(
        userMessage.id,
        userMessage.conversationId,
        userMessage.role,
        userMessage.content,
        userMessage.timestamp,
      );

      // Get LLM response
      const allMessages = [...history, userMessage];
      const { message: assistantMessage, log } = await llmClient.chat(
        allMessages,
        validated.model,
      );

      // Store assistant message
      db.prepare(
        "INSERT INTO messages (id, conversation_id, role, content, summary, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        assistantMessage.id,
        assistantMessage.conversationId,
        assistantMessage.role,
        assistantMessage.content,
        assistantMessage.summary || null,
        assistantMessage.timestamp,
      );

      // Store inference log
      db.prepare(
        `
        INSERT INTO inference_logs (
          id, message_id, conversation_id, model, provider,
          latency_ms, prompt_tokens, completion_tokens, total_tokens,
          status, error, input_preview, output_preview, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        log.id,
        log.messageId,
        log.conversationId,
        log.model,
        log.provider,
        log.latencyMs,
        log.tokenUsage.prompt,
        log.tokenUsage.completion,
        log.tokenUsage.total,
        log.status,
        log.error || null,
        log.inputPreview,
        log.outputPreview,
        log.timestamp,
      );

      // Update conversation timestamp
      db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
        Date.now(),
        conversation.id,
      );

      const response: ChatResponse = {
        message: assistantMessage,
        conversation,
        log,
      };

      return c.json(response);
    } catch (error) {
      console.error("Chat error:", error);
      if (error instanceof z.ZodError) {
        return c.json({ error: "Invalid request", details: error.errors }, 400);
      }
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Internal server error",
        },
        500,
      );
    }
  });

  // Get all conversations for user
  app.get("/api/conversations", (c) => {
    const user = c.get("user") as User;
    const conversations = db
      .prepare(
        "SELECT * FROM conversations WHERE status = ? AND user_id = ? ORDER BY updated_at DESC",
      )
      .all("active", user.id) as Conversation[];
    return c.json(conversations);
  });

  // Get single conversation with messages (ensure ownership)
  app.get("/api/conversations/:id", (c) => {
    const user = c.get("user") as User;
    const id = c.req.param("id");

    const conversation = db
      .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
      .get(id, user.id) as Conversation | undefined;

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    const messages = db
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
      )
      .all(id) as Message[];

    const logs = db
      .prepare(
        "SELECT * FROM inference_logs WHERE conversation_id = ? ORDER BY timestamp DESC",
      )
      .all(id) as InferenceLog[];

    return c.json({ conversation, messages, logs });
  });

  // Delete conversation (soft delete) – check ownership
  app.delete("/api/conversations/:id", (c) => {
    const user = c.get("user") as User;
    const id = c.req.param("id");

    const exists = db
      .prepare(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ? AND status = 'active'",
      )
      .get(id, user.id);
    if (!exists) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    db.prepare("UPDATE conversations SET status = 'archived' WHERE id = ?").run(
      id,
    );
    return c.json({ success: true });
  });

  // Resume conversation (unarchive) – check ownership
  app.post("/api/conversations/:id/resume", (c) => {
    const user = c.get("user") as User;
    const id = c.req.param("id");

    const exists = db
      .prepare(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ? AND status = 'archived'",
      )
      .get(id, user.id);
    if (!exists) {
      return c.json({ error: "Conversation not found or already active" }, 404);
    }

    db.prepare("UPDATE conversations SET status = 'active' WHERE id = ?").run(
      id,
    );
    return c.json({ success: true });
  });

  // Ingestion endpoint (protected, but no user filtering needed here)
  app.post("/api/ingest/batch", async (c) => {
    try {
      const body = (await c.req.json()) as LogBatchRequest;

      if (!body.logs || !Array.isArray(body.logs)) {
        return c.json({ error: "Invalid payload: logs array required" }, 400);
      }

      const insertMany = db.transaction((db, logs: InferenceLog[]) => {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO inference_logs (
            id, message_id, conversation_id, model, provider,
            latency_ms, prompt_tokens, completion_tokens, total_tokens,
            status, error, input_preview, output_preview, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const log of logs) {
          stmt.run(
            log.id,
            log.messageId,
            log.conversationId,
            log.model,
            log.provider,
            log.latencyMs,
            log.tokenUsage.prompt,
            log.tokenUsage.completion,
            log.tokenUsage.total,
            log.status,
            log.error || null,
            log.inputPreview,
            log.outputPreview,
            log.timestamp,
          );
        }
      });

      insertMany(body.logs);

      return c.json({
        success: true,
        processed: body.logs.length,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Ingestion error:", error);
      return c.json(
        {
          error: "Failed to process logs",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  // Dashboard stats (could be filtered by user, but we'll keep global for now)
  app.get("/api/stats", (c) => {
    try {
      const stats = {
        totalConversations: db
          .prepare(
            "SELECT COUNT(*) as count FROM conversations WHERE status = ?",
          )
          .get("active"),
        totalMessages: db
          .prepare("SELECT COUNT(*) as count FROM messages")
          .get(),
        avgLatency: db
          .prepare(
            "SELECT AVG(latency_ms) as avg FROM inference_logs WHERE status = 'success'",
          )
          .get(),
        errorRate: db
          .prepare(
            "SELECT ROUND(COUNT(CASE WHEN status = 'error' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as rate FROM inference_logs",
          )
          .get(),
        tokenUsage: db
          .prepare(
            `
            SELECT 
              COALESCE(SUM(prompt_tokens), 0) as total_prompt,
              COALESCE(SUM(completion_tokens), 0) as total_completion,
              COALESCE(SUM(total_tokens), 0) as total_tokens
            FROM inference_logs WHERE status = 'success'
          `,
          )
          .get(),
        modelDistribution: db
          .prepare(
            "SELECT model, COUNT(*) as count FROM inference_logs GROUP BY model ORDER BY count DESC",
          )
          .all(),
        recentLogs: db
          .prepare(
            "SELECT * FROM inference_logs ORDER BY timestamp DESC LIMIT 50",
          )
          .all(),
      };

      return c.json(stats);
    } catch (error) {
      console.error("Stats error:", error);
      return c.json({ error: "Failed to fetch stats" }, 500);
    }
  });

  return app;
}
