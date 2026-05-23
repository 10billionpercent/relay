import React, { useState, useEffect, useRef } from "react";
import { Menu, Loader2 } from "lucide-react";
import type { Message, Conversation, Model, UserData } from "./types";
import { MODEL_NAMES, API_URL } from "./constants";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ChatView from "./components/ChatView";

function App() {
  // ─── Auth state ──────────────────────────
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<UserData | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [serverDown, setServerDown] = useState(false);
  const serverDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── App state ───────────────────────────
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
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem("selectedModel") || "llama-3.1-8b-instant",
  );
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Sidebar state ───────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ─── Copy / Edit ─────────────────────────
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // ─── Context menu ────────────────────────
  const [menuOpenConvId, setMenuOpenConvId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ─── Rename ──────────────────────────────
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // ─── Loading conversation ────────────────
  const [loadingConversationId, setLoadingConversationId] = useState<
    string | null
  >(null);
  const loadConversationAbortRef = useRef<AbortController | null>(null);

  const currentConversationTitle = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)?.title ||
      "Untitled"
    : "New Conversation";

  // ─── Effects ─────────────────────────────
  useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const newHeight = textarea.scrollHeight;
    const maxHeight = 8 * 24 + 32;
    if (newHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = "hidden";
    }
  }, [input]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      )
        setModelDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpenConvId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (currentConversationId && messages.length > 0)
      localStorage.setItem(
        `messages_${currentConversationId}`,
        JSON.stringify(messages),
      );
  }, [messages, currentConversationId]);

  // Background token verification
  useEffect(() => {
    if (!token) {
      localStorage.removeItem("user");
      setUser(null);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (serverDownTimerRef.current) {
          clearTimeout(serverDownTimerRef.current);
          serverDownTimerRef.current = null;
        }
        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
          setServerDown(false);
        } else if (res.ok) {
          const data = await res.json();
          setUser({ id: data.id, username: data.username });
          localStorage.setItem(
            "user",
            JSON.stringify({ id: data.id, username: data.username }),
          );
          setServerDown(false);
        } else {
          if (!serverDownTimerRef.current)
            serverDownTimerRef.current = setTimeout(
              () => setServerDown(true),
              1500,
            );
        }
      } catch {
        if (!serverDownTimerRef.current)
          serverDownTimerRef.current = setTimeout(
            () => setServerDown(true),
            1500,
          );
      }
    })();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
      if (serverDownTimerRef.current) {
        clearTimeout(serverDownTimerRef.current);
        serverDownTimerRef.current = null;
      }
    };
  }, [token]);

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

  useEffect(() => {
    if (currentConversationId)
      localStorage.setItem("currentConversationId", currentConversationId);
    else localStorage.removeItem("currentConversationId");
  }, [currentConversationId]);

  // ─── Functions ───────────────────────────
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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
        } else setAuthError(data.error);
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setAuthUsername("");
        setAuthPassword("");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    }
  };

  const loadModels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/models`);
      const data = await res.json();
      setModels(data);
      if (data.length > 0 && !localStorage.getItem("selectedModel"))
        setSelectedModel(data[0].model);
    } catch {}
  };

  const loadConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(await res.json());
    } catch {}
  };

  const loadConversation = async (id: string) => {
    if (!token) return;
    setShowDashboard(false);
    if (loadConversationAbortRef.current)
      loadConversationAbortRef.current.abort();
    setCurrentConversationId(id);
    setLoadingConversationId(id);
    const controller = new AbortController();
    loadConversationAbortRef.current = controller;
    try {
      const res = await fetch(`${API_URL}/api/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
        localStorage.setItem(`messages_${id}`, JSON.stringify(data.messages));
      }
    } catch (err: any) {
      if (err.name !== "AbortError")
        console.error("Failed to load conversation:", err);
    } finally {
      if (loadConversationAbortRef.current === controller)
        loadConversationAbortRef.current = null;
      setLoadingConversationId(null);
    }
  };

  const stopGenerating = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
  };

  const copyMessage = async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const editMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setInput(msg.content);
    textareaRef.current?.focus();
  };
  const cancelEdit = () => {
    setEditingMessageId(null);
    setInput("");
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !token) return;
    if (editingMessageId) {
      const idx = messages.findIndex((m) => m.id === editingMessageId);
      if (idx !== -1) setMessages(messages.slice(0, idx));
      setEditingMessageId(null);
    }
    setLoading(true);
    setError(null);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
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
      if (data.error) setError(data.error);
      else {
        setMessages((prev) => [...prev, data.message]);
        if (!currentConversationId)
          setCurrentConversationId(data.conversation.id);
        setInput("");
        loadConversations();
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError("Failed to send message.");
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
    setEditingMessageId(null);
  };
  const deleteConversation = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
    } finally {
      localStorage.removeItem(`messages_${id}`);
      if (currentConversationId === id) newConversation();
      loadConversations();
      setMenuOpenConvId(null);
    }
  };
  const renameConversation = async (id: string, newTitle: string) => {
    if (!token || !newTitle.trim()) return;
    try {
      await fetch(`${API_URL}/api/conversations/${id}/rename`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      loadConversations();
    } catch {
    } finally {
      setRenamingConvId(null);
      setMenuOpenConvId(null);
    }
  };
  const loadStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(await res.json());
      setShowDashboard(true);
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape" && editingMessageId) {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ─── Render ──────────────────────────────
  if (!user)
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        authUsername={authUsername}
        setAuthUsername={setAuthUsername}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authError={authError}
        handleAuth={handleAuth}
      />
    );

  return (
    <div
      className="h-screen flex bg-[#111315] text-white"
      style={{ fontFamily: "'Cabin', sans-serif", fontWeight: "500" }}
    >
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        conversations={conversations}
        currentConversationId={currentConversationId}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        serverDown={serverDown}
        renamingConvId={renamingConvId}
        setRenamingConvId={setRenamingConvId}
        renameTitle={renameTitle}
        setRenameTitle={setRenameTitle}
        menuOpenConvId={menuOpenConvId}
        setMenuOpenConvId={setMenuOpenConvId}
        menuRef={menuRef}
        loadingConversationId={loadingConversationId}
        onSelectConversation={(id) => {
          loadConversation(id);
          setMobileSidebarOpen(false);
        }}
        onNewConversation={newConversation}
        onDashboard={loadStats}
        onLogout={logout}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
      />

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
          {loadingConversationId && (
            <Loader2 size={16} className="animate-spin ml-3 text-gray-400" />
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {showDashboard && stats ? (
            <Dashboard stats={stats} onRefresh={loadStats} />
          ) : (
            <ChatView
              setSelectedModel={setSelectedModel}
              messages={messages}
              user={user}
              selectedModel={selectedModel}
              input={input}
              setInput={setInput}
              loading={loading}
              error={error}
              editingMessageId={editingMessageId}
              onCancelEdit={cancelEdit}
              copiedId={copiedId}
              textareaRef={textareaRef}
              messagesEndRef={messagesEndRef}
              models={models}
              modelDropdownOpen={modelDropdownOpen}
              setModelDropdownOpen={setModelDropdownOpen}
              modelDropdownRef={modelDropdownRef as any}
              onKeyDown={handleKeyDown}
              onSend={sendMessage}
              onStop={stopGenerating}
              onCopy={copyMessage}
              onEdit={editMessage}
              title={currentConversationTitle}
              loadingConversationId={loadingConversationId}
              onDismissError={() => setError(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
