import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import type { Message, Conversation, Model, UserData } from "./types";
import { API_URL } from "./constants";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";

// ─── sessionStorage helpers for guest mode ──
const GUEST_USER: UserData = { id: "guest", username: "Guest" };

function getGuestConversations(): Conversation[] {
  try {
    return JSON.parse(sessionStorage.getItem("guestConversations") || "[]");
  } catch {
    return [];
  }
}
function setGuestConversations(convs: Conversation[]) {
  sessionStorage.setItem("guestConversations", JSON.stringify(convs));
}
function getGuestMessages(convId: string): Message[] {
  try {
    return JSON.parse(
      sessionStorage.getItem(`guestMessages_${convId}`) || "[]",
    );
  } catch {
    return [];
  }
}
function setGuestMessages(convId: string, msgs: Message[]) {
  sessionStorage.setItem(`guestMessages_${convId}`, JSON.stringify(msgs));
}

// Guest‑side dashboard stats builder
function computeGuestStats() {
  const convs = getGuestConversations();
  let totalMessages = 0;
  const modelCount: Record<string, number> = {};

  convs.forEach((c) => {
    const msgs = getGuestMessages(c.id);
    totalMessages += msgs.length;
    msgs.forEach((m) => {
      if (m.role === "assistant" && (m as any).model) {
        const mdl = (m as any).model;
        modelCount[mdl] = (modelCount[mdl] || 0) + 1;
      }
    });
  });

  const modelDistribution = Object.entries(modelCount)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalConversations: { count: convs.length },
    totalMessages: { count: totalMessages },
    avgLatency: { avg: null },
    errorRate: { rate: 0 },
    tokenUsage: { total_prompt: 0, total_completion: 0, total_tokens: 0 },
    modelDistribution,
    recentLogs: [],
  };
}

// ─── Root component ──────────────────────
function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

// ─── Routes + global state ───────────────
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<UserData | null>(() => {
    if (sessionStorage.getItem("isGuest") === "true") return GUEST_USER;
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [serverDown, setServerDown] = useState(false);
  const serverDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGuest = user?.id === "guest";

  // App state
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (isGuest) return getGuestConversations();
    return [];
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Sidebar / UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [menuOpenConvId, setMenuOpenConvId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [loadingConversationId, setLoadingConversationId] = useState<
    string | null
  >(null);
  const loadConversationAbortRef = useRef<AbortController | null>(null);

  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(() => {
    if (isGuest)
      return sessionStorage.getItem("guestCurrentConversationId") || null;
    return localStorage.getItem("currentConversationId") || null;
  });

  // Sync URL param → state
  const SyncConversationId = () => {
    const { conversationId } = useParams<{ conversationId?: string }>();
    useEffect(() => {
      if (conversationId) {
        setCurrentConversationId(conversationId);
      } else {
        setCurrentConversationId(null);
      }
    }, [conversationId]);
    return null;
  };

  // ─── Effects ────────────────────────────
  useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const newHeight = textarea.scrollHeight;
    const maxHeight = 8 * 24 + 32;
    textarea.style.height = `${Math.min(newHeight, maxHeight)}px`;
    textarea.style.overflowY = newHeight > maxHeight ? "auto" : "hidden";
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
    if (isGuest && currentConversationId && messages.length > 0) {
      setGuestMessages(currentConversationId, messages);
    }
  }, [messages, currentConversationId, isGuest]);

  // Background token verification (only for authenticated users)
  useEffect(() => {
    if (isGuest) return;
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
  }, [token, isGuest]);

  useEffect(() => {
    if (!user) return;
    if (isGuest) {
      setConversations(getGuestConversations());
      loadModels();
      const savedId = sessionStorage.getItem("guestCurrentConversationId");
      if (savedId) {
        const msgs = getGuestMessages(savedId);
        setMessages(msgs);
        setCurrentConversationId(savedId);
        if (location.pathname === "/dashboard") return;
        navigate(`/chat/${savedId}`, { replace: true });
      } else {
        if (location.pathname === "/dashboard") return;
        navigate(`/chat`, { replace: true });
      }
    } else {
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
        if (location.pathname === "/dashboard") return;
        navigate(`/chat/${savedId}`, { replace: true });
      } else {
        if (location.pathname === "/dashboard") return;
        navigate(`/chat`, { replace: true });
      }
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (currentConversationId) {
      if (isGuest)
        sessionStorage.setItem(
          "guestCurrentConversationId",
          currentConversationId,
        );
      else localStorage.setItem("currentConversationId", currentConversationId);
    } else {
      sessionStorage.removeItem("guestCurrentConversationId");
      localStorage.removeItem("currentConversationId");
    }
  }, [currentConversationId, isGuest]);

  useEffect(() => {
    if (location.pathname === "/dashboard" && user && !isGuest && token) {
      loadStats();
    }
  }, [location.pathname, user, token, isGuest]);

  // ─── Functions ───────────────────────────
  const logout = () => {
    if (isGuest) {
      sessionStorage.removeItem("isGuest");
      sessionStorage.removeItem("guestConversations");
      sessionStorage.removeItem("guestCurrentConversationId");
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    localStorage.removeItem("currentConversationId");
    setToken(null);
    setUser(null);
    setConversations([]);
    setCurrentConversationId(null);
    setMessages([]);
    setServerDown(false);
    navigate("/login");
  };

  const handleGuestLogin = () => {
    sessionStorage.setItem("isGuest", "true");
    setUser(GUEST_USER);
    navigate("/chat");
  };

  const handleAuth = async (
    mode: "login" | "signup",
    username: string,
    password: string,
    setAuthError: (err: string) => void,
  ) => {
    setAuthError("");
    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.code === "USER_NOT_FOUND")
          setAuthError("No account found. Please sign up.");
        else if (data.code === "USERNAME_TAKEN")
          setAuthError("Username already taken. Please log in.");
        else setAuthError(data.error);
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        navigate("/chat");
      }
    } catch {
      setAuthError("Network error.");
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
    if (isGuest) {
      setMessages(getGuestMessages(id));
      setCurrentConversationId(id);
      return;
    }
    if (!token) return;
    if (loadConversationAbortRef.current)
      loadConversationAbortRef.current.abort();
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
      if (err.name !== "AbortError") console.error(err);
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
    if (!input.trim() || loading) return;
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
    if (currentConversationId && !isGuest)
      payload.conversationId = currentConversationId;
    abortControllerRef.current = new AbortController();
    try {
      const endpoint = isGuest
        ? `${API_URL}/api/chat/guest`
        : `${API_URL}/api/chat`;
      const headers: any = { "Content-Type": "application/json" };
      if (!isGuest) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        const assistantWithModel = { ...data.message, model: selectedModel };
        setMessages((prev) => [...prev, assistantWithModel]);
        if (!currentConversationId) {
          const newConvId = data.message?.id || generateUUID();
          setCurrentConversationId(newConvId);
          navigate(`/chat/${newConvId}`, { replace: true });
          if (isGuest) {
            const convs = getGuestConversations();
            convs.unshift({
              id: newConvId,
              title: input.substring(0, 50) + (input.length > 50 ? "..." : ""),
              updatedAt: Date.now(),
            });
            setGuestConversations(convs);
            setConversations(convs);
          }
        }
        setInput("");
        if (!isGuest) loadConversations();
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError("Failed to send message.");
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  const newConversation = () => {
    stopGenerating();
    setMessages([]);
    setInput("");
    setError(null);
    setEditingMessageId(null);
    navigate("/chat");
  };

  const deleteConversation = async (id: string) => {
    if (isGuest) {
      const convs = getGuestConversations().filter((c) => c.id !== id);
      setGuestConversations(convs);
      setConversations(convs);
      sessionStorage.removeItem(`guestMessages_${id}`);
      if (currentConversationId === id) newConversation();
      setMenuOpenConvId(null);
      return;
    }
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
    if (isGuest) {
      const convs = getGuestConversations().map((c) =>
        c.id === id ? { ...c, title: newTitle } : c,
      );
      setGuestConversations(convs);
      setConversations(convs);
      setRenamingConvId(null);
      setMenuOpenConvId(null);
      return;
    }
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

  // ─── Routes ─────────────────────────────
  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/chat" replace />
          ) : (
            <AuthPage onAuth={handleAuth} onGuest={handleGuestLogin} />
          )
        }
      />
      <Route
        path="/chat"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <>
              <SyncConversationId />
              <ChatPage
                user={user}
                conversations={conversations}
                currentConversationId={currentConversationId}
                messages={messages}
                input={input}
                setInput={setInput}
                loading={loading}
                error={error}
                showDashboard={false}
                stats={null}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                models={models}
                modelDropdownOpen={modelDropdownOpen}
                setModelDropdownOpen={setModelDropdownOpen}
                modelDropdownRef={modelDropdownRef as any}
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
                copiedId={copiedId}
                editingMessageId={editingMessageId}
                textareaRef={textareaRef}
                messagesEndRef={messagesEndRef}
                onSelectConversation={(id) => {
                  loadConversation(id);
                  navigate(`/chat/${id}`);
                  setMobileSidebarOpen(false);
                }}
                onNewConversation={newConversation}
                onDashboard={() => navigate("/dashboard")}
                onLogout={logout}
                onDeleteConversation={deleteConversation}
                onRenameConversation={renameConversation}
                onSend={sendMessage}
                onStop={stopGenerating}
                onCopy={copyMessage}
                onEdit={editMessage}
                onCancelEdit={cancelEdit}
                onDismissError={() => setError(null)}
                onKeyDown={handleKeyDown}
              />
            </>
          )
        }
      />
      <Route
        path="/chat/:conversationId"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <>
              <SyncConversationId />
              <ChatPage
                user={user}
                conversations={conversations}
                currentConversationId={currentConversationId}
                messages={messages}
                input={input}
                setInput={setInput}
                loading={loading}
                error={error}
                showDashboard={false}
                stats={null}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                models={models}
                modelDropdownOpen={modelDropdownOpen}
                setModelDropdownOpen={setModelDropdownOpen}
                modelDropdownRef={modelDropdownRef as any}
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
                copiedId={copiedId}
                editingMessageId={editingMessageId}
                textareaRef={textareaRef}
                messagesEndRef={messagesEndRef}
                onSelectConversation={(id) => {
                  loadConversation(id);
                  navigate(`/chat/${id}`);
                  setMobileSidebarOpen(false);
                }}
                onNewConversation={newConversation}
                onDashboard={() => navigate("/dashboard")}
                onLogout={logout}
                onDeleteConversation={deleteConversation}
                onRenameConversation={renameConversation}
                onSend={sendMessage}
                onStop={stopGenerating}
                onCopy={copyMessage}
                onEdit={editMessage}
                onCancelEdit={cancelEdit}
                onDismissError={() => setError(null)}
                onKeyDown={handleKeyDown}
              />
            </>
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : isGuest ? (
            <ChatPage
              user={user}
              conversations={conversations}
              currentConversationId={null}
              messages={[]}
              input=""
              setInput={() => {}}
              loading={false}
              error={null}
              showDashboard={true}
              stats={computeGuestStats()}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              models={models}
              modelDropdownOpen={modelDropdownOpen}
              setModelDropdownOpen={setModelDropdownOpen}
              modelDropdownRef={modelDropdownRef as any}
              sidebarCollapsed={sidebarCollapsed}
              setSidebarCollapsed={setSidebarCollapsed}
              mobileSidebarOpen={mobileSidebarOpen}
              setMobileSidebarOpen={setMobileSidebarOpen}
              serverDown={serverDown}
              renamingConvId={null}
              setRenamingConvId={() => {}}
              renameTitle=""
              setRenameTitle={() => {}}
              menuOpenConvId={null}
              setMenuOpenConvId={() => {}}
              menuRef={menuRef}
              loadingConversationId={null}
              copiedId={null}
              editingMessageId={null}
              textareaRef={textareaRef}
              messagesEndRef={messagesEndRef}
              onSelectConversation={(id) => {
                loadConversation(id);
                navigate(`/chat/${id}`);
                setMobileSidebarOpen(false);
              }}
              onNewConversation={newConversation}
              onDashboard={() => navigate("/dashboard")}
              onLogout={logout}
              onDeleteConversation={deleteConversation}
              onRenameConversation={renameConversation}
              onSend={() => {}}
              onStop={() => {}}
              onCopy={() => {}}
              onEdit={() => {}}
              onCancelEdit={() => {}}
              onDismissError={() => {}}
              onKeyDown={() => {}}
            />
          ) : (
            <ChatPage
              user={user}
              conversations={conversations}
              currentConversationId={null}
              messages={[]}
              input=""
              setInput={() => {}}
              loading={false}
              error={null}
              showDashboard={true}
              stats={stats}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              models={models}
              modelDropdownOpen={modelDropdownOpen}
              setModelDropdownOpen={setModelDropdownOpen}
              modelDropdownRef={modelDropdownRef as any}
              sidebarCollapsed={sidebarCollapsed}
              setSidebarCollapsed={setSidebarCollapsed}
              mobileSidebarOpen={mobileSidebarOpen}
              setMobileSidebarOpen={setMobileSidebarOpen}
              serverDown={serverDown}
              renamingConvId={null}
              setRenamingConvId={() => {}}
              renameTitle=""
              setRenameTitle={() => {}}
              menuOpenConvId={null}
              setMenuOpenConvId={() => {}}
              menuRef={menuRef}
              loadingConversationId={null}
              copiedId={null}
              editingMessageId={null}
              textareaRef={textareaRef}
              messagesEndRef={messagesEndRef}
              onSelectConversation={(id) => {
                loadConversation(id);
                navigate(`/chat/${id}`);
                setMobileSidebarOpen(false);
              }}
              onNewConversation={newConversation}
              onDashboard={() => navigate("/dashboard")}
              onLogout={logout}
              onDeleteConversation={deleteConversation}
              onRenameConversation={renameConversation}
              onSend={() => {}}
              onStop={() => {}}
              onCopy={() => {}}
              onEdit={() => {}}
              onCancelEdit={() => {}}
              onDismissError={() => {}}
              onKeyDown={() => {}}
            />
          )
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={
              user
                ? isGuest
                  ? sessionStorage.getItem("guestCurrentConversationId")
                    ? `/chat/${sessionStorage.getItem("guestCurrentConversationId")}`
                    : "/chat"
                  : localStorage.getItem("currentConversationId")
                    ? `/chat/${localStorage.getItem("currentConversationId")}`
                    : "/chat"
                : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
