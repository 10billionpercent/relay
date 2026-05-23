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
  LLMResponse,
} from "@relay/shared";
import type { IDatabaseWrapper } from "./db-interface";
import crypto from "crypto";

declare module "hono" {
  interface ContextVariableMap {
    user: User;
    db: IDatabaseWrapper;
  }
}

// Password helpers (unchanged)
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
  const user = (await c
    .get("db")
    .prepare("SELECT * FROM users WHERE token = ?")
    .get(token)) as User | undefined;
  if (!user) {
    return c.json({ error: "Invalid token" }, 401);
  }
  c.set("user", user);
  await next();
}

// Helper to map snake_case DB rows to camelCase Message objects
function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as "user" | "assistant" | "system",
    content: row.content as string,
    summary: row.summary as string | undefined,
    timestamp: row.timestamp as number,
  };
}

async function generateConversationTitle(
  userMessage: string,
  assistantMessage: string,
  llmClient: LoggedLLMClient,
): Promise<string> {
  try {
    // Access the raw Groq provider (bypasses the SDK's JSON‑wrapping prompt)
    const groqProvider = (llmClient as any).providers?.get("groq");
    if (!groqProvider) throw new Error("Groq provider not available");

    const messages: Message[] = [
      {
        id: uuidv4(),
        conversationId: "title-gen",
        role: "system",
        content:
          "You are a title generator. Write a very short, natural, descriptive title (2-3 words) for this conversation. Output ONLY the title – no punctuation, no quotes, no markdown, no extra text.",
        timestamp: Date.now(),
      },
      {
        id: uuidv4(),
        conversationId: "title-gen",
        role: "user",
        content: `User: ${userMessage}\nAssistant: ${assistantMessage}`,
        timestamp: Date.now(),
      },
    ];

    // Direct call → returns LLMResponse (has .content directly)
    const response: LLMResponse = await groqProvider.chat(
      messages,
      "llama-3.3-70b-versatile",
    );

    let raw = response.content.trim();
    console.log("[Title] Raw LLM response:", raw);

    // Remove any remaining punctuation / quotes
    raw = raw
      .replace(/[^\w\s]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Take first 3 words (max)
    const words = raw.split(/\s+/).slice(0, 3);
    const title = words.join(" ");

    console.log("[Title] Final title:", title);
    return (
      title ||
      userMessage.substring(0, 30).split(" ").slice(0, 3).join(" ") ||
      "New Chat"
    );
  } catch (e) {
    console.error("[Title] Generation failed, using fallback:", e);
    return (
      userMessage.substring(0, 30).split(" ").slice(0, 3).join(" ") ||
      "New Chat"
    );
  }
}

export function createRoutes(db: IDatabaseWrapper, llmClient: LoggedLLMClient) {
  const app = new Hono();

  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  });

  app.use(
    "/*",
    cors({
      origin: (origin) => {
        const allowed = [
          "http://localhost:5173",
          "http://localhost:3000",
          "http://127.0.0.1:5173",
          "https://relay-ai-chat.pages.dev",
        ];
        return allowed.includes(origin) ? origin : allowed[0];
      },
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  // Health check
  app.get("/api/health", (c) =>
    c.json({ status: "ok", timestamp: Date.now() }),
  );

  // Get available models
  app.get("/api/models", (c) => {
    const models = llmClient.getAvailableModels();
    return c.json(models);
  });

  // ----- Auth routes -----
  app.post("/api/auth/signup", async (c) => {
    try {
      const body = await c.req.json();
      const { username, password } = signupSchema.parse(body);

      const existing = await db
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

      await db
        .prepare(
          "INSERT INTO users (id, username, password_hash, token, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(id, username, storedHash, token, createdAt);

      return c.json({ token, user: { id, username } } as AuthResponse, 201);
    } catch (error) {
      if (error instanceof z.ZodError)
        return c.json({ error: "Invalid input", details: error.errors }, 400);
      console.error("Signup error:", error);
      return c.json({ error: "Signup failed" }, 500);
    }
  });

  app.post("/api/auth/login", async (c) => {
    try {
      const body = await c.req.json();
      const { username, password } = loginSchema.parse(body);

      const user = (await db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username)) as User | undefined;
      if (!user)
        return c.json(
          {
            error: "No account found. Please sign up first.",
            code: "USER_NOT_FOUND",
          },
          404,
        );

      const [salt, hash] = user.password_hash.split(":");
      if (!verifyPassword(password, salt, hash))
        return c.json({ error: "Incorrect password." }, 401);

      const token = uuidv4();
      await db
        .prepare("UPDATE users SET token = ? WHERE id = ?")
        .run(token, user.id);

      return c.json({
        token,
        user: { id: user.id, username: user.username },
      } as AuthResponse);
    } catch (error) {
      if (error instanceof z.ZodError)
        return c.json({ error: "Invalid input", details: error.errors }, 400);
      console.error("Login error:", error);
      return c.json({ error: "Login failed" }, 500);
    }
  });

  app.get("/api/auth/me", authMiddleware, (c) => {
    const user = c.get("user") as User;
    return c.json({ id: user.id, username: user.username });
  });

  // Protected routes
  app.use("/api/chat", authMiddleware);
  app.use("/api/conversations/*", authMiddleware);
  app.use("/api/ingest/*", authMiddleware);
  app.use("/api/stats", authMiddleware);

  // Chat endpoint (fully awaited)
  app.post("/api/chat", async (c) => {
    try {
      const user = c.get("user") as User;
      const body = await c.req.json();
      const validated = chatSchema.parse(body);

      let conversation: Conversation;

      if (validated.conversationId) {
        const existing = (await db
          .prepare(
            "SELECT * FROM conversations WHERE id = ? AND status = ? AND user_id = ?",
          )
          .get(validated.conversationId, "active", user.id)) as
          | Conversation
          | undefined;

        if (!existing)
          return c.json({ error: "Conversation not found or archived" }, 404);
        conversation = existing;
      } else {
        const id = uuidv4();
        conversation = {
          id,
          title: "New Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "active",
          userId: user.id,
        };

        await db
          .prepare(
            "INSERT INTO conversations (id, title, created_at, updated_at, status, user_id) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            conversation.id,
            conversation.title,
            conversation.createdAt,
            conversation.updatedAt,
            conversation.status,
            conversation.userId,
          );
      }

      // Get history
      const historyRows = await db
        .prepare(
          "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
        )
        .all(conversation.id);
      const history: Message[] = historyRows.map(mapMessage);

      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        conversationId: conversation.id,
        role: "user",
        content: validated.message,
        timestamp: Date.now(),
      };

      await db
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
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

      const assistantMsgWithModel: Message = {
        ...assistantMessage,
        model: validated.model,
      };

      if (!assistantMsgWithModel.content.trim()) {
        assistantMsgWithModel.content =
          "I'm sorry, I couldn't generate a response. Please try again.";
      }

      // Store assistant message
      await db
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content, summary, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          assistantMsgWithModel.id,
          assistantMsgWithModel.conversationId,
          assistantMsgWithModel.role,
          assistantMsgWithModel.content,
          assistantMsgWithModel.summary || null,
          assistantMsgWithModel.timestamp,
        );

      // Store inference log
      await db
        .prepare(
          `
        INSERT INTO inference_logs (
          id, message_id, conversation_id, model, provider,
          latency_ms, prompt_tokens, completion_tokens, total_tokens,
          status, error, input_preview, output_preview, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
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
      await db
        .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
        .run(Date.now(), conversation.id);

      // Title generation for new conversations
      if (!validated.conversationId) {
        try {
          console.log("[Title] Generating title...");
          const title = await generateConversationTitle(
            validated.message,
            assistantMsgWithModel.content,
            llmClient,
          );
          await db
            .prepare("UPDATE conversations SET title = ? WHERE id = ?")
            .run(title, conversation.id);
          conversation.title = title;
        } catch (err) {
          console.error("Failed to update title:", err);
        }
      }

      return c.json({
        message: assistantMsgWithModel,
        conversation,
        log,
      } as ChatResponse);
    } catch (error) {
      console.error("Chat error:", error);
      if (error instanceof z.ZodError)
        return c.json({ error: "Invalid request", details: error.errors }, 400);
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
  app.get("/api/conversations", async (c) => {
    const user = c.get("user") as User;
    const conversations = (await db
      .prepare(
        "SELECT * FROM conversations WHERE status = ? AND user_id = ? ORDER BY updated_at DESC",
      )
      .all("active", user.id)) as unknown as Conversation[];
    return c.json(conversations);
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (c) => {
    const user = c.get("user") as User;
    const id = c.req.param("id");

    const conversation = (await db
      .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
      .get(id, user.id)) as Conversation | undefined;

    if (!conversation) return c.json({ error: "Conversation not found" }, 404);

    const messageRows = await db
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
      )
      .all(id);
    const messages: Message[] = messageRows.map(mapMessage);

    const logs = (await db
      .prepare(
        "SELECT * FROM inference_logs WHERE conversation_id = ? ORDER BY timestamp DESC",
      )
      .all(id)) as unknown as InferenceLog[];

    return c.json({ conversation, messages, logs });
  });

  // Delete conversation (soft delete)
  app.delete("/api/conversations/:id", async (c) => {
    const user = c.get("user") as User;
    const id = c.req.param("id");

    const exists = await db
      .prepare(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ? AND status = 'active'",
      )
      .get(id, user.id);
    if (!exists) return c.json({ error: "Conversation not found" }, 404);

    await db
      .prepare("UPDATE conversations SET status = 'archived' WHERE id = ?")
      .run(id);
    return c.json({ success: true });
  });

  // Resume conversation
  app.post("/api/conversations/:id/resume", async (c) => {
    const user = c.get("user") as User;
    const id = c.req.param("id");

    const exists = await db
      .prepare(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ? AND status = 'archived'",
      )
      .get(id, user.id);
    if (!exists)
      return c.json({ error: "Conversation not found or already active" }, 404);

    await db
      .prepare("UPDATE conversations SET status = 'active' WHERE id = ?")
      .run(id);
    return c.json({ success: true });
  });

  // Ingestion endpoint
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

  // Dashboard stats (per‑user)
  app.get("/api/stats", async (c) => {
    try {
      const user = c.get("user") as User;

      const stats = {
        totalConversations: await db
          .prepare(
            "SELECT COUNT(*) as count FROM conversations WHERE status = ? AND user_id = ?",
          )
          .get("active", user.id),
        totalMessages: await db
          .prepare(
            `SELECT COUNT(*) as count FROM messages m INNER JOIN conversations c ON m.conversation_id = c.id WHERE c.user_id = ?`,
          )
          .get(user.id),
        avgLatency: await db
          .prepare(
            `SELECT AVG(il.latency_ms) as avg FROM inference_logs il INNER JOIN conversations c ON il.conversation_id = c.id WHERE c.user_id = ? AND il.status = 'success'`,
          )
          .get(user.id),
        errorRate: await db
          .prepare(
            `SELECT ROUND(COUNT(CASE WHEN il.status = 'error' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as rate FROM inference_logs il INNER JOIN conversations c ON il.conversation_id = c.id WHERE c.user_id = ?`,
          )
          .get(user.id),
        tokenUsage: await db
          .prepare(
            `SELECT COALESCE(SUM(il.prompt_tokens), 0) as total_prompt, COALESCE(SUM(il.completion_tokens), 0) as total_completion, COALESCE(SUM(il.total_tokens), 0) as total_tokens FROM inference_logs il INNER JOIN conversations c ON il.conversation_id = c.id WHERE c.user_id = ? AND il.status = 'success'`,
          )
          .get(user.id),
        modelDistribution: await db
          .prepare(
            `SELECT il.model, COUNT(*) as count FROM inference_logs il INNER JOIN conversations c ON il.conversation_id = c.id WHERE c.user_id = ? GROUP BY il.model ORDER BY count DESC`,
          )
          .all(user.id),
        recentLogs: await db
          .prepare(
            `SELECT il.* FROM inference_logs il INNER JOIN conversations c ON il.conversation_id = c.id WHERE c.user_id = ? ORDER BY il.timestamp DESC LIMIT 50`,
          )
          .all(user.id),
      };

      return c.json(stats);
    } catch (error) {
      console.error("Stats error:", error);
      return c.json({ error: "Failed to fetch stats" }, 500);
    }
  });

  return app;
}
