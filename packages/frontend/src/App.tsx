import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  Menu,
  X,
  LogOut,
  Plus,
  BarChart3,
  Trash2,
  MessageCircle,
  UserCircle,
  AlertTriangle,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  PanelLeftClose,
  PanelLeft,
  Square,
  ChevronDown,
} from "lucide-react";

interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

interface Model {
  provider: string;
  model: string;
}

interface UserData {
  id: string;
  username: string;
}

const MODEL_NAMES: Record<string, string> = {
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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(!!token);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [serverDown, setServerDown] = useState(false);

  // App state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("llama-3.1-8b-instant");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // NEW ref for auto-resize

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const currentConversationTitle = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)?.title ||
      "Untitled"
    : "New Conversation";

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to recalculate
    textarea.style.height = "0px";
    const newHeight = textarea.scrollHeight;

    // Max height for ~8 rows (approx 8 * 24px per row + padding)
    const maxHeight = 8 * 24 + 32; // ~224px

    if (newHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = "hidden";
    }
  }, [input]);

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Persist messages in localStorage
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      localStorage.setItem(
        `messages_${currentConversationId}`,
        JSON.stringify(messages),
      );
    }
  }, [messages, currentConversationId]);

  // Verify token on mount with timeout
  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }

    let didCancel = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const verify = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (didCancel) return;

        if (res.status === 401) {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
          setServerDown(false);
        } else if (res.ok) {
          const data = await res.json();
          setUser({ id: data.id, username: data.username });
          setServerDown(false);
        } else {
          setServerDown(true);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.warn("Auth check timed out");
        }
        setServerDown(true);
      } finally {
        if (!didCancel) {
          setAuthLoading(false);
        }
      }
    };

    verify();

    return () => {
      didCancel = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [token]);

  // When user is set, load conversations and resume last conversation
  useEffect(() => {
    if (!user) return;
    loadConversations();
    loadModels();

    const savedId = localStorage.getItem("currentConversationId");
    if (savedId) {
      const savedMessages = localStorage.getItem(`messages_${savedId}`);
      if (savedMessages) {
        try {
          setMessages(JSON.parse(savedMessages));
        } catch {}
      }
      setCurrentConversationId(savedId);
      loadConversation(savedId);
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist current conversation ID
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem("currentConversationId", currentConversationId);
    } else {
      localStorage.removeItem("currentConversationId");
    }
  }, [currentConversationId]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentConversationId");
    setToken(null);
    setUser(null);
    setConversations([]);
    setCurrentConversationId(null);
    setMessages([]);
    setServerDown(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint =
      authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.code === "USER_NOT_FOUND") {
          setAuthError("No account found. Please sign up.");
          setAuthMode("signup");
        } else if (data.code === "USERNAME_TAKEN") {
          setAuthError("Username already taken. Please log in.");
          setAuthMode("login");
        } else {
          setAuthError(data.error);
        }
      } else {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthUsername("");
        setAuthPassword("");
      }
    } catch (err) {
      setAuthError("Network error. Please try again.");
    }
  };

  const loadModels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/models`);
      const data = await res.json();
      setModels(data);
      if (data.length > 0) setSelectedModel(data[0].model);
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  };

  const loadConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const loadConversation = async (id: string) => {
    if (!token) return;
    setShowDashboard(false);
    try {
      const res = await fetch(`${API_URL}/api/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
        setCurrentConversationId(id);
        localStorage.setItem(`messages_${id}`, JSON.stringify(data.messages));
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !token) return;
    setLoading(true);
    setError(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const payload: any = { message: input, model: selectedModel };
    if (currentConversationId) payload.conversationId = currentConversationId;

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessages((prev) => [...prev, data.message]);
        if (!currentConversationId)
          setCurrentConversationId(data.conversation.id);
        setInput("");
        loadConversations();
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // silently stopped
      } else {
        setError("Failed to send message. Please try again.");
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const newConversation = () => {
    stopGenerating();
    setShowDashboard(false);
    setCurrentConversationId(null);
    setMessages([]);
    setInput("");
    setError(null);
  };

  const deleteConversation = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      localStorage.removeItem(`messages_${id}`);
      if (currentConversationId === id) newConversation();
      loadConversations();
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const loadStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
      setShowDashboard(true);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---- Loading screen while checking auth ----
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#111315]">
        <div className="text-white text-lg animate-pulse">
          Verifying session…
        </div>
      </div>
    );
  }

  // ---- Auth screen ----
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111315] p-4">
        <div className="bg-[#1a1d21] rounded-2xl p-6 sm:p-10 max-w-md w-full text-center shadow-lg">
          <img src="/relay.png" alt="Relay" className="w-16 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-6">
            {authMode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <form onSubmit={handleAuth} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
            />
            {authError && (
              <p className="text-red-500 text-sm break-words">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-[#00cfff] text-[#111315] font-semibold rounded-lg hover:bg-[#00b5e6] transition"
            >
              {authMode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>
          <p className="mt-4 text-gray-400 text-sm">
            {authMode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => setAuthMode("signup")}
                  className="text-[#00cfff] underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setAuthMode("login")}
                  className="text-[#00cfff] underline"
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="h-screen flex bg-[#111315] text-white">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          flex flex-col
          bg-[#1a1d21] border-r border-[#2a2d33]
          transition-all duration-300
          ${sidebarCollapsed && !mobileSidebarOpen ? "w-16" : "w-64"}
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div
          className={`flex items-center h-16 px-4 border-b border-[#2a2d33] ${sidebarCollapsed ? "justify-center" : "justify-between"}`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/relay.png"
              alt="Relay"
              className="w-8 h-8 flex-shrink-0"
            />
            {!sidebarCollapsed && (
              <span className="text-white font-semibold text-lg whitespace-nowrap">
                Relay
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded hover:bg-[#2a2d33] text-gray-400"
          >
            {sidebarCollapsed ? (
              <PanelLeft size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded hover:bg-[#2a2d33] text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className={`px-4 py-3 border-b border-[#2a2d33] ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}
        >
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <UserCircle size={20} className="text-gray-400" />
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm truncate">{user.username}</span>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white flex items-center gap-1"
              >
                <LogOut size={14} /> <span className="text-xs">Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Server down warning */}
        {serverDown && (
          <div className="px-3 py-2 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg mx-3 mb-2">
            ⚠️ Server unreachable – using cached data
          </div>
        )}

        <div className="p-3 space-y-2">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-3 px-3 py-2 bg-[#00cfff] text-[#111315] font-medium rounded-lg hover:bg-[#00b5e6] transition"
          >
            <Plus size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>New Chat</span>}
          </button>
          <button
            onClick={loadStats}
            className="w-full flex items-center gap-3 px-3 py-2 bg-[#24272c] text-white rounded-lg hover:bg-[#2a2d33] transition"
          >
            <BarChart3 size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          {!sidebarCollapsed && (
            <h3 className="text-xs uppercase text-gray-400 mb-2 mt-2">
              Conversations
            </h3>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => {
                loadConversation(conv.id);
                setMobileSidebarOpen(false);
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1 transition ${
                conv.id === currentConversationId
                  ? "bg-[#2a2d33] border-l-2 border-[#00cfff]"
                  : "hover:bg-[#24272c]"
              } ${sidebarCollapsed ? "justify-center px-1" : ""}`}
            >
              {sidebarCollapsed ? (
                <MessageCircle size={18} className="text-gray-400" />
              ) : (
                <span className="text-sm truncate flex-1">{conv.title}</span>
              )}
              {!sidebarCollapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 hover:opacity-100 hover:text-red-500 text-gray-500 transition"
                  title="Delete conversation"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {conversations.length === 0 && !sidebarCollapsed && (
            <p className="text-gray-500 text-xs text-center py-4">
              No conversations yet
            </p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center h-16 px-4 border-b border-[#2a2d33] bg-[#1a1d21] lg:px-6">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden mr-3 text-gray-400 hover:text-white flex-shrink-0"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold truncate">
            {showDashboard ? "Analytics Dashboard" : currentConversationTitle}
          </h1>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {showDashboard && stats ? (
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 size={24} /> Analytics Dashboard
                </h2>
                <button
                  onClick={loadStats}
                  className="flex items-center gap-2 px-4 py-2 bg-[#24272c] rounded-lg hover:bg-[#2a2d33] self-start sm:self-auto"
                >
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
                  <h3 className="text-gray-400 text-sm">
                    Active Conversations
                  </h3>
                  <p className="text-2xl font-bold">
                    {stats.totalConversations?.count || 0}
                  </p>
                </div>
                <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
                  <h3 className="text-gray-400 text-sm">Total Messages</h3>
                  <p className="text-2xl font-bold">
                    {stats.totalMessages?.count || 0}
                  </p>
                </div>
                <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
                  <h3 className="text-gray-400 text-sm">Avg Latency</h3>
                  <p className="text-2xl font-bold">
                    {stats.avgLatency?.avg
                      ? `${stats.avgLatency.avg.toFixed(0)}ms`
                      : "N/A"}
                  </p>
                </div>
                <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
                  <h3 className="text-gray-400 text-sm">Error Rate</h3>
                  <p className="text-2xl font-bold">
                    {stats.errorRate?.rate ? `${stats.errorRate.rate}%` : "0%"}
                  </p>
                </div>
                <div className="bg-[#1a1d21] p-5 rounded-xl shadow">
                  <h3 className="text-gray-400 text-sm">Total Tokens</h3>
                  <p className="text-2xl font-bold">
                    {stats.tokenUsage?.total_tokens?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Model Distribution
                </h3>
                <div className="space-y-2">
                  {stats.modelDistribution?.map((item: any) => (
                    <div key={item.model} className="flex items-center gap-3">
                      <span
                        className="w-32 sm:w-40 text-sm text-gray-300 truncate"
                        title={item.model}
                      >
                        {MODEL_NAMES[item.model] || item.model}
                      </span>
                      <div className="flex-1 bg-[#24272c] rounded-full h-2">
                        <div
                          className="bg-[#00cfff] h-2 rounded-full"
                          style={{
                            width: `${(item.count / Math.max(...stats.modelDistribution.map((d: any) => d.count))) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-400 w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Recent Inference Logs
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#24272c] text-gray-400 uppercase">
                      <tr>
                        <th className="px-4 py-2">Time</th>
                        <th className="px-4 py-2">Model</th>
                        <th className="px-4 py-2">Latency</th>
                        <th className="px-4 py-2">Tokens</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentLogs?.map((log: any) => (
                        <tr key={log.id} className="border-b border-[#2a2d33]">
                          <td className="px-4 py-2 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2" title={log.model}>
                            {MODEL_NAMES[log.model] || log.model}
                          </td>
                          <td className="px-4 py-2">{log.latency_ms}ms</td>
                          <td className="px-4 py-2">{log.total_tokens}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                log.status === "success"
                                  ? "bg-green-900/30 text-green-400"
                                  : "bg-red-900/30 text-red-400"
                              }`}
                            >
                              {log.status === "success" ? (
                                <CheckCircle size={14} />
                              ) : (
                                <XCircle size={14} />
                              )}
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center mt-20 text-gray-400">
                    <MessageCircle size={48} className="mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">
                      AI Chat Assistant
                    </h1>
                    <p>
                      Start a conversation with the AI using Groq's fast
                      inference
                    </p>
                    <p className="mt-2">
                      Current model:{" "}
                      <strong className="text-[#00cfff]" title={selectedModel}>
                        {MODEL_NAMES[selectedModel] || selectedModel}
                      </strong>
                    </p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-2xl break-words ${
                        msg.role === "user"
                          ? "bg-[#00cfff]/20 text-white rounded-br-sm"
                          : "bg-[#24272c] text-white rounded-bl-sm shadow"
                      }`}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-[#24272c] px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1.5 py-2">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <span
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <span
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {error && (
                <div className="bg-red-600 text-white px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm break-words">{error}</span>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Input area with CUSTOM MODEL DROPDOWN */}
              <div className="p-3 sm:p-4 border-t border-[#2a2d33] bg-[#1a1d21]">
                <div className="flex flex-col gap-2">
                  {/* Custom Model Selector */}
                  <div className="relative w-48 sm:w-56" ref={modelDropdownRef}>
                    <button
                      onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      className="w-full flex items-center justify-between bg-[#24272c] border border-[#2a2d33] text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00cfff]"
                    >
                      <span className="truncate">
                        {MODEL_NAMES[selectedModel] || selectedModel}
                      </span>
                      <ChevronDown
                        size={12}
                        className={`ml-2 transition-transform ${
                          modelDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {modelDropdownOpen && (
                      <div className="absolute z-50 bottom-full mb-1 w-full bg-[#1a1d21] border border-[#2a2d33] rounded-lg shadow-lg overflow-hidden">
                        {models.map((m) => (
                          <button
                            key={m.model}
                            onClick={() => {
                              setSelectedModel(m.model);
                              setModelDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#24272c] transition ${
                              m.model === selectedModel
                                ? "bg-[#24272c] border-l-2 border-[#00cfff] text-[#00cfff]"
                                : "text-gray-300"
                            }`}
                            title={m.model}
                          >
                            {MODEL_NAMES[m.model] || m.model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Textarea + send/stop row */}
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${MODEL_NAMES[selectedModel] || selectedModel}`}
                      rows={1}
                      disabled={loading}
                      className="flex-1 bg-[#24272c] border border-[#2a2d33] rounded-lg p-3 text-white resize-none focus:outline-none focus:border-[#00cfff] text-sm"
                      style={{
                        minHeight: "44px",
                        maxHeight: "224px", // ~8 rows
                      }}
                    />
                    {loading ? (
                      <button
                        onClick={stopGenerating}
                        className="flex-shrink-0 p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                        title="Stop generating"
                      >
                        <Square size={16} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        className="flex-shrink-0 p-3 bg-[#00cfff] text-[#111315] rounded-lg hover:bg-[#00b5e6] disabled:opacity-50 transition"
                        title="Send message"
                      >
                        <Send size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
