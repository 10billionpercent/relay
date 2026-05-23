export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  summary?: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: "active" | "archived";
  userId: string; // new
}

export interface InferenceLog {
  id: string;
  messageId: string;
  conversationId: string;
  model: string;
  provider: string;
  latencyMs: number;
  tokenUsage: TokenUsage;
  status: "success" | "error";
  error?: string;
  inputPreview: string;
  outputPreview: string;
  timestamp: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  tokenUsage: TokenUsage;
}

export interface LogBatchRequest {
  logs: InferenceLog[];
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  provider?: string;
  model?: string;
}

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
  log: InferenceLog;
}

export interface DashboardStats {
  totalConversations: { count: number };
  totalMessages: { count: number };
  avgLatency: { avg: number | null };
  errorRate: { rate: number | null };
  tokenUsage: {
    total_prompt: number;
    total_completion: number;
    total_tokens: number;
  };
  modelDistribution: Array<{ model: string; count: number }>;
  recentLogs: InferenceLog[];
}

export interface User {
  id: string;
  username: string;
  password_hash: string; // was passwordHash
  token: string | null;
  created_at: number;
}

export interface SignupRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}
