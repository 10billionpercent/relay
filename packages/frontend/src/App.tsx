import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

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

interface User {
  id: string;
  username: string;
}

const API_URL = "http://localhost:3001";

function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentConversationTitle = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)?.title ||
      "Untitled"
    : "New Conversation";

  // Verify token on mount
  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setUser({ id: data.id, username: data.username });
          } else {
            logout();
          }
        })
        .catch(() => logout());
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadModels();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setConversations([]);
    setCurrentConversationId(null);
    setMessages([]);
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
        // Smart error handling with auto‑switch
        if (data.code === "USER_NOT_FOUND") {
          // User tried to login but doesn't exist → switch to signup
          setAuthError("No account found. Please sign up.");
          setAuthMode("signup");
        } else if (data.code === "USERNAME_TAKEN") {
          // User tried to signup but username taken → switch to login
          setAuthError("Username already taken. Please log in.");
          setAuthMode("login");
        } else {
          setAuthError(data.error);
        }
      } else {
        // Success
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
    try {
      const res = await fetch(`${API_URL}/api/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
        setCurrentConversationId(id);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
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

    const payload: any = {
      message: input,
      model: selectedModel,
    };
    if (currentConversationId) {
      payload.conversationId = currentConversationId;
    }

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setMessages((prev) => [...prev, data.message]);

        if (!currentConversationId) {
          setCurrentConversationId(data.conversation.id);
        }

        setInput("");
        loadConversations();
      }
    } catch (err) {
      setError("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const newConversation = () => {
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
      if (currentConversationId === id) {
        newConversation();
      }
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

  // Auth screen
  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <img src="/relay.png" alt="Relay" className="auth-logo" />
          <h2>{authMode === "login" ? "Welcome back" : "Create account"}</h2>
          <form onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
            {authError && <p className="auth-error">{authError}</p>}
            <button type="submit">
              {authMode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>
          <p className="auth-switch">
            {authMode === "login" ? (
              <>
                Don't have an account?{" "}
                <button onClick={() => setAuthMode("signup")}>Sign up</button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setAuthMode("login")}>Log in</button>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="app">
      <div className="sidebar">
        <div className="user-info">
          <span>👤 {user.username}</span>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
        <button onClick={newConversation} className="new-chat-btn">
          ✨ New Chat
        </button>
        <button onClick={loadStats} className="stats-btn">
          📊 Dashboard
        </button>

        <div className="model-selector">
          <label htmlFor="model-select">Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.model} value={m.model}>
                {m.model}
              </option>
            ))}
          </select>
        </div>

        <div className="conversations-list">
          <h3>Conversations</h3>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentConversationId ? "active" : ""}`}
              onClick={() => loadConversation(conv.id)}
            >
              <span className="conv-title">{conv.title}</span>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                title="Delete conversation"
              >
                🗑️
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="no-conversations">No conversations yet</p>
          )}
        </div>
      </div>

      <div className="main">
        {showDashboard && stats ? (
          <div className="dashboard">
            <div className="dashboard-header">
              <h2>📊 Analytics Dashboard</h2>
              <button onClick={loadStats} className="refresh-btn">
                🔄 Refresh
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Active Conversations</h3>
                <p className="stat-value">
                  {stats.totalConversations?.count || 0}
                </p>
              </div>
              <div className="stat-card">
                <h3>Total Messages</h3>
                <p className="stat-value">{stats.totalMessages?.count || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Average Latency</h3>
                <p className="stat-value">
                  {stats.avgLatency?.avg
                    ? `${stats.avgLatency.avg.toFixed(0)}ms`
                    : "N/A"}
                </p>
              </div>
              <div className="stat-card">
                <h3>Error Rate</h3>
                <p className="stat-value">
                  {stats.errorRate?.rate ? `${stats.errorRate.rate}%` : "0%"}
                </p>
              </div>
              <div className="stat-card">
                <h3>Total Tokens Used</h3>
                <p className="stat-value">
                  {stats.tokenUsage?.total_tokens?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>Model Distribution</h3>
              <div className="model-distribution">
                {stats.modelDistribution?.map((item: any) => (
                  <div key={item.model} className="model-bar">
                    <span className="model-name">{item.model}</span>
                    <div className="bar-container">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(item.count / Math.max(...stats.modelDistribution.map((d: any) => d.count))) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="model-count">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-section">
              <h3>Recent Inference Logs</h3>
              <div className="logs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Model</th>
                      <th>Latency</th>
                      <th>Tokens</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentLogs?.map((log: any) => (
                      <tr key={log.id}>
                        <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td>{log.model}</td>
                        <td>{log.latency_ms}ms</td>
                        <td>{log.total_tokens}</td>
                        <td>
                          <span className={`status-badge ${log.status}`}>
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
            <div className="chat-header">
              <h2>{currentConversationTitle}</h2>
            </div>

            <div className="messages-container">
              {messages.length === 0 && (
                <div className="welcome">
                  <div className="welcome-icon">💬</div>
                  <h1>AI Chat Assistant</h1>
                  <p>
                    Start a conversation with the AI using Groq's fast inference
                  </p>
                  <div className="model-info">
                    Current model: <strong>{selectedModel}</strong>
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div className="message-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="message assistant">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="error-banner">
                <span>⚠️ {error}</span>
                <button onClick={() => setError(null)}>×</button>
              </div>
            )}

            <div className="input-container">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                rows={3}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="send-btn"
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
