import { serve } from "@hono/node-server";
import { initializeDatabase, DatabaseWrapper } from "./database.js"; // adjust path if needed
import { createRoutes } from "./routes.js";
import { LoggedLLMClient, GroqProvider } from "@relay/sdk";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  console.log("🚀 Starting LLM Chat Backend...");

  // Initialize database
  console.log("📦 Initializing database...");
  const db: DatabaseWrapper = await initializeDatabase();
  console.log("✅ Database ready");

  // Initialize LLM client with logging
  const llmClient = new LoggedLLMClient(`http://localhost:${PORT}`);

  // Add Groq provider
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error("❌ GROQ_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log("🤖 Initializing Groq provider...");
  const groqProvider = new GroqProvider(groqApiKey);

  // 🔥 CRUCIAL: Added await so the server pauses until the models finish fetching over the network
  await llmClient.addProvider(groqProvider);

  console.log("✅ Groq provider ready");
  console.log("📋 Available models:", groqProvider.models.join(", "));

  // Create routes
  const app = createRoutes(db, llmClient);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n👋 Shutting down...");
    llmClient.destroy();
    db.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n👋 Shutting down...");
    llmClient.destroy();
    db.close();
    process.exit(0);
  });

  console.log(`🌐 Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard stats at http://localhost:${PORT}/api/stats`);
  console.log(`💚 Health check at http://localhost:${PORT}/api/health`);

  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

main().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
