import { v4 as uuidv4 } from "uuid";
import { LogBatcher } from "./logger";
import { GroqProvider } from "./providers";
import type { LLMProvider } from "./providers";
import type { Message, InferenceLog, TokenUsage } from "@relay/shared";

export class LoggedLLMClient {
  private providers: Map<string, LLMProvider> = new Map();
  private logBatcher: LogBatcher;

  private systemPrompt = `You are a helpful AI assistant. Always format your response as a JSON object with two fields:
{
  "reply": "Your full detailed response to the user",
  "summary": "A one-sentence summary of what you said in this response"
}

Make sure your response is valid JSON. Do not include any text outside the JSON object.`;

  constructor(ingestionEndpoint: string) {
    this.logBatcher = new LogBatcher(ingestionEndpoint);
  }

  // Made async to wait for the dynamic models fetch to finish
  async addProvider(provider: LLMProvider): Promise<void> {
    if (provider.initialize) {
      await provider.initialize();
    }
    this.providers.set(provider.name, provider);
  }

  getAvailableModels(): Array<{ provider: string; model: string }> {
    const models: Array<{ provider: string; model: string }> = [];
    this.providers.forEach((provider) => {
      provider.models.forEach((model) => {
        models.push({ provider: provider.name, model });
      });
    });
    return models;
  }

  async chat(
    messages: Message[],
    model: string = "llama-3.1-8b-instant",
  ): Promise<{ message: Message; log: InferenceLog }> {
    let selectedProvider: LLMProvider | undefined;
    let providerName = "groq";

    for (const [name, provider] of this.providers) {
      if (provider.models.includes(model)) {
        selectedProvider = provider;
        providerName = name;
        break;
      }
    }

    if (!selectedProvider) {
      throw new Error(`No provider found for model: ${model}`);
    }

    const conversationId = messages[0]?.conversationId || uuidv4();
    const startTime = Date.now();
    const contextMessages = this.prepareContext(messages);

    try {
      const response = await selectedProvider.chat(contextMessages, model);
      const latency = Date.now() - startTime;

      let content = response.content;
      let summary = "";

      try {
        const parsed = JSON.parse(response.content);
        if (parsed.reply) {
          content = parsed.reply;
          summary = parsed.summary || content.substring(0, 100);
        }
      } catch {
        summary = content.substring(0, 100) + "...";
      }

      const message: Message = {
        id: uuidv4(),
        conversationId,
        role: "assistant",
        content,
        summary,
        timestamp: Date.now(),
      };

      const log: InferenceLog = {
        id: uuidv4(),
        messageId: message.id,
        conversationId,
        model: response.model,
        provider: response.provider,
        latencyMs: latency,
        tokenUsage: response.tokenUsage,
        status: "success",
        inputPreview: JSON.stringify(contextMessages.slice(-3)).substring(
          0,
          500,
        ),
        outputPreview: content.substring(0, 200),
        timestamp: Date.now(),
      };

      this.logBatcher.addLog(log).catch(console.error);
      return { message, log };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const log: InferenceLog = {
        id: uuidv4(),
        messageId: "",
        conversationId,
        model,
        provider: providerName,
        latencyMs: latency,
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        status: "error",
        error: errorMessage,
        inputPreview: JSON.stringify(contextMessages.slice(-3)).substring(
          0,
          500,
        ),
        outputPreview: "",
        timestamp: Date.now(),
      };

      this.logBatcher.addLog(log).catch(console.error);
      throw error;
    }
  }

  private prepareContext(
    messages: Message[],
  ): { role: string; content: string }[] {
    const result: { role: string; content: string }[] = [];
    result.push({ role: "system", content: this.systemPrompt });

    const recentMessages = messages.slice(-6);
    const olderMessages = messages.slice(0, -6);
    if (olderMessages.length > 0) {
      const summaries = olderMessages
        .filter((m) => m.role === "assistant" && m.summary)
        .map((m) => m.summary)
        .join(" ");

      if (summaries) {
        result.push({
          role: "system",
          content: `Previous conversation summary: ${summaries}`,
        });
      }
    }

    recentMessages.forEach((msg) => {
      result.push({ role: msg.role, content: msg.content });
    });

    return result;
  }

  destroy(): void {
    this.logBatcher.destroy();
  }
}

export { GroqProvider } from "./providers";
export { LogBatcher } from "./logger";
