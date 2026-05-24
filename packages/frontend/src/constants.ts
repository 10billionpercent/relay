export const MODELS = {
  "llama-3.1-8b-instant": {
    name: "Flash",
    description: "Fastest responses for everyday chats.",
  },

  "llama-3.3-70b-versatile": {
    name: "Vector",
    description: "Balanced model for most tasks.",
  },

  "qwen/qwen3-32b": {
    name: "Cipher",
    description: "Sharp thinking for technical questions.",
  },

  "groq/compound-mini": {
    name: "Pulse Mini",
    description: "Lightweight model for quick interactions.",
  },

  "groq/compound": {
    name: "Pulse Max",
    description: "Powerful model for longer conversations.",
  },

  "openai/gpt-oss-20b": {
    name: "Nova Core",
    description: "Creative and reliable general assistant.",
  },

  "openai/gpt-oss-120b": {
    name: "Nova Prime",
    description: "Deep reasoning for complex problems.",
  },

  "meta-llama/llama-4-scout-17b-16e-instruct": {
    name: "Scout",
    description: "Context-aware model for exploration.",
  },

  "allam-2-7b": {
    name: "Mirage",
    description: "Smooth conversational lightweight assistant.",
  },
};

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
