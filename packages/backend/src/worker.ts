import { Hono } from "hono";
import { LoggedLLMClient, GroqProvider } from "@relay/sdk";
import { createRoutes } from "./routes";
import { D1DatabaseWrapper } from "./database-d1";
import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  GROQ_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = new D1DatabaseWrapper(env.DB);

    // Compute ingestion URL from the request
    const url = new URL(request.url);
    const ingestionUrl = `${url.origin}/api/ingest/batch`;

    const llmClient = new LoggedLLMClient(ingestionUrl);
    const groqProvider = new GroqProvider(env.GROQ_API_KEY);
    await llmClient.addProvider(groqProvider);

    const app = createRoutes(db, llmClient);

    return app.fetch(request);
  },
};
