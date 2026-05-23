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

const API_URL = "http://localhost:3001";

function App() {
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
  ? conversations.find((c) => c.id === currentConversationId)?.title || "Untitled"
  : "New Conversation";

  useEffect(() => {
    loadConversations();
    loadModels();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadModels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/models`);
      const data = await res.json();
      setModels(data);
      if (data.length > 0) {
        setSelectedModel(data[0].model);
      }
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/conversations`);
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${id}`);
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
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);

    // 1. Create user message for instant display
    const userMessage: Message = {
      id: Date.now().toString(), // temporary local ID
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    // 2. Add to the state right now (optimistic update)
    setMessages((prev) => [...prev, userMessage]);

    // 3. Build payload (only include conversationId if present)
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        // 4. Append the assistant's response to the existing messages
        setMessages((prev) => [...prev, data.message]);

        // Update the current conversation ID if it was a new chat
        if (!currentConversationId) {
          setCurrentConversationId(data.conversation.id);
        }

        // Clear input and refresh sidebar
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
    try {
      await fetch(`${API_URL}/api/conversations/${id}`, { method: "DELETE" });
      if (currentConversationId === id) {
        newConversation();
      }
      loadConversations();
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats`);
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

  return (
    <div className="app">
      <div className="sidebar">
        <button onClick={newConversation} className="new-chat-btn">
          ✨ New Chat
        </button>
        <button onClick={loadStats} className="stats-btn">
          📊 Dashboard
        </button>

        {/* Model Selector */}
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
