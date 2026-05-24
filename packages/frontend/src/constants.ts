export const MODEL_NAMES: Record<string, string> = {
  "llama-3.1-8b-instant": "Flash",
  "llama-3.3-70b-versatile": "Vector",
  "qwen/qwen3-32b": "Cipher",
  "groq/compound-mini": "Pulse Mini",
  "groq/compound": "Pulse Max",
  "openai/gpt-oss-20b": "Nova Core",
  "openai/gpt-oss-120b": "Nova Prime",
  "meta-llama/llama-4-scout-17b-16e-instruct": "Scout",
  "allam-2-7b": "Mirage",
};

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
