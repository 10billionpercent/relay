import Groq from "groq-sdk";
import type { LLMResponse, TokenUsage } from "@relay/shared";

export interface LLMProvider {
  name: string;
  models: string[];
  initialize?(): Promise<void>;
  chat(
    messages: { role: string; content: string }[],
    model: string,
  ): Promise<LLMResponse>;
}

// Models containing these keywords are classifiers / non‑chat models
const NON_CHAT_KEYWORDS = [
  "prompt-guard",
  "safeguard",
  "moderation",
  "guard",
  "classifier",
  "embedding",
  "whisper",
  "orpheus",
];

export class GroqProvider implements LLMProvider {
  name = "groq";
  models: string[] = [];

  private client: Groq;
  private defaultModel = "llama-3.1-8b-instant";

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async initialize(): Promise<void> {
    try {
      const response = await this.client.models.list();
      this.models = response.data
        .map((m) => m.id)
        .filter((id) => !id.includes("whisper") && !id.includes("orpheus"))
        .filter(
          (id) =>
            !NON_CHAT_KEYWORDS.some((kw) => id.toLowerCase().includes(kw)),
        );

      console.log(`[Groq] Synced ${this.models.length} chat models.`);
    } catch (error) {
      console.error(
        "[Groq] Failed to fetch models, using fallback list.",
        error,
      );
      this.models = [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
        "qwen/qwen3-32b",
        "llama3-8b-8192",
      ];
    }
  }

  async chat(
    messages: { role: string; content: string }[],
    model: string = this.defaultModel,
  ): Promise<LLMResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: messages.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })),
        temperature: 0.7,
      });

      const usage: TokenUsage = {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      };

      return {
        content: completion.choices[0]?.message?.content || "",
        model: completion.model || model,
        provider: this.name,
        tokenUsage: usage,
      };
    } catch (error) {
      throw new Error(
        `Groq API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
