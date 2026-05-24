import React, { useState, useEffect, useRef, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LogOut,
  Plus,
  BarChart3,
  PanelLeft,
  MessageCircle,
} from "lucide-react";
import type { Conversation } from "../types";
import ConversationItem from "./ConversationItem";

interface SidebarProps {
  user: { username: string } | null;
  conversations: Conversation[];
  currentConversationId: string | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
  serverDown: boolean;
  renamingConvId: string | null;
  setRenamingConvId: (id: string | null) => void;
  renameTitle: string;
  setRenameTitle: (v: string) => void;
  menuOpenConvId: string | null;
  setMenuOpenConvId: (id: string | null) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  loadingConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDashboard: () => void;
  onLogout: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
}

export default function Sidebar(props: SidebarProps) {
  const {
    user,
    conversations,
    currentConversationId,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    serverDown,
    renamingConvId,
    setRenamingConvId,
    renameTitle,
    setRenameTitle,
    menuOpenConvId,
    setMenuOpenConvId,
    menuRef,
    loadingConversationId,
    onSelectConversation,
    onNewConversation,
    onDashboard,
    onLogout,
    onDeleteConversation,
    onRenameConversation,
  } = props;

  const [collapsedChatsOpen, setCollapsedChatsOpen] = useState(false);
  const collapsedDropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close collapsed chat dropdown on outside click
  useEffect(() => {
    if (!collapsedChatsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        collapsedDropdownRef.current &&
        !collapsedDropdownRef.current.contains(e.target as Node)
      ) {
        setCollapsedChatsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [collapsedChatsOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (sidebarRef.current && !sidebarRef.current.contains(target)) {
        e.stopPropagation();
        setMobileSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("touchstart", handler, { capture: true }); // no passive:false needed since we don't call preventDefault
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchstart", handler, { capture: true });
    };
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const lastTenChats = conversations.slice(0, 10);
  const showExpandedContent = !sidebarCollapsed || mobileSidebarOpen;
  const sidebarWidth = showExpandedContent ? 256 : 64;

  // Helper that always closes mobile sidebar and selects conversation
  const selectConversationAndClose = (id: string) => {
    setMobileSidebarOpen(false);
    setRenamingConvId(null);
    onSelectConversation(id);
  };

  return (
    <div
      ref={sidebarRef}
      className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[#1a1d21] border-r border-[#2a2d33] transition-all duration-300 overflow-visible ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div className="flex items-center h-16 px-4 border-b border-[#2a2d33] justify-between">
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 overflow-hidden"
            >
              <img
                src="/relay.png"
                alt="Relay"
                className="w-8 h-8 flex-shrink-0"
              />
              <span
                className="text-[#00cfff] text-xl whitespace-nowrap"
                style={{ fontFamily: "'Racing Sans One', cursive" }}
              >
                Relay
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded hover:bg-[#2a2d33] text-gray-400 ml-auto"
        >
          <PanelLeft size={18} />
        </button>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {showExpandedContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-[#2a2d33]">
              <div className="flex items-center justify-between">
                <span className="text-sm truncate">{user?.username}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onLogout();
                  }}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <LogOut size={18} /> <span className="text-sm">Logout</span>
                </button>
              </div>
            </div>

            {serverDown && (
              <div className="px-3 py-2 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg mx-3 mb-2">
                ⚠️ Server unreachable – using cached data
              </div>
            )}

            <div className="p-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  onNewConversation();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 bg-[#00cfff] text-[#111315] font-medium rounded-lg hover:bg-[#00b5e6] transition"
              >
                <Plus size={18} className="flex-shrink-0" />
                <span>New Chat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  onDashboard();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 bg-[#24272c] text-white rounded-lg hover:bg-[#2a2d33] transition"
              >
                <BarChart3 size={18} className="flex-shrink-0" />
                <span>Dashboard</span>
              </button>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto px-3">
              <h3 className="text-xs uppercase text-gray-400 mb-2 mt-2">
                Conversations
              </h3>
              {conversations.length === 0 && (
                <p className="text-gray-500 text-xs text-center py-4">
                  No conversations yet
                </p>
              )}
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === currentConversationId}
                  isLoading={loadingConversationId === conv.id}
                  isRenaming={renamingConvId === conv.id}
                  renameTitle={renameTitle}
                  setRenameTitle={setRenameTitle}
                  onSelect={() => selectConversationAndClose(conv.id)}
                  onDelete={() => onDeleteConversation(conv.id)}
                  onRename={() => onRenameConversation(conv.id, renameTitle)}
                  onStartRename={() => {
                    setRenamingConvId(conv.id);
                    setRenameTitle(conv.title);
                    setMenuOpenConvId(null);
                  }}
                  menuOpenConvId={menuOpenConvId}
                  setMenuOpenConvId={setMenuOpenConvId}
                  menuRef={menuRef}
                  sidebarCollapsed={false}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed desktop view */}
      <AnimatePresence>
        {sidebarCollapsed && !mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col items-center py-4 gap-4"
          >
            <button
              type="button"
              onClick={onLogout}
              className="p-3 rounded-lg hover:bg-[#2a2d33] text-gray-400 hover:text-red-400 transition"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
            <button
              type="button"
              onClick={onNewConversation}
              className="p-3 rounded-lg bg-[#00cfff] text-[#111315] hover:bg-[#00b5e6] transition"
              title="New Chat"
            >
              <Plus size={20} />
            </button>
            <button
              type="button"
              onClick={onDashboard}
              className="p-3 rounded-lg bg-[#24272c] text-white hover:bg-[#2a2d33] transition"
              title="Dashboard"
            >
              <BarChart3 size={20} />
            </button>
            <div className="relative" ref={collapsedDropdownRef}>
              <button
                type="button"
                onClick={() => setCollapsedChatsOpen(!collapsedChatsOpen)}
                className="p-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-gray-300 hover:text-white hover:border-[#00cfff] transition"
                title="Recent Chats"
              >
                <MessageCircle size={18} />
              </button>
              <AnimatePresence>
                {collapsedChatsOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-full ml-2 top-0 w-56 bg-[#1a1d21] border border-[#2a2d33] rounded-lg shadow-lg overflow-hidden z-50"
                  >
                    {/* Inside the collapsed dropdown motion.div */}
                    {lastTenChats.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-gray-500 text-center">
                        No conversations yet
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xs uppercase text-gray-400 mb-2 mt-2 px-3">
                          Recent Chats
                        </h3>
                        {lastTenChats.map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => {
                              onSelectConversation(conv.id);
                              setCollapsedChatsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm truncate hover:bg-[#24272c] transition ${
                              conv.id === currentConversationId
                                ? "bg-[#24272c] border-l-2 border-[#00cfff] text-[#00cfff]"
                                : "text-gray-300"
                            }`}
                            title={conv.title}
                          >
                            {conv.title}
                          </button>
                        ))}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
