import React, { RefObject } from "react";
import {
  X,
  LogOut,
  Plus,
  BarChart3,
  UserCircle,
  PanelLeftClose,
  PanelLeft,
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

export default function Sidebar({
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
}: SidebarProps) {
  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[#1a1d21] border-r border-[#2a2d33] transition-all duration-300 ${
        sidebarCollapsed && !mobileSidebarOpen ? "w-16" : "w-64"
      } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      {/* Header */}
      <div
        className={`flex items-center h-16 px-4 border-b border-[#2a2d33] ${
          sidebarCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <img src="/relay.png" alt="Relay" className="w-8 h-8 flex-shrink-0" />
          {!sidebarCollapsed && (
            <span
              className="text-[#00cfff] text-xl whitespace-nowrap"
              style={{ fontFamily: "'Racing Sans One', cursive" }}
            >
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

      {/* User info */}
      <div
        className={`px-4 py-3 border-b border-[#2a2d33] ${
          sidebarCollapsed ? "flex flex-col items-center" : ""
        }`}
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <UserCircle size={20} className="text-gray-400" />
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-s truncate">{user?.username}</span>
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-white flex items-center gap-1"
            >
              <LogOut size={16} /> <span className="text-s">Logout</span>
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

      {/* Action buttons */}
      <div className="p-3 space-y-2">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-3 px-3 py-2 bg-[#00cfff] text-[#111315] font-medium rounded-lg hover:bg-[#00b5e6] transition"
        >
          <Plus size={18} className="flex-shrink-0" />
          {!sidebarCollapsed && <span>New Chat</span>}
        </button>
        <button
          onClick={onDashboard}
          className="w-full flex items-center gap-3 px-3 py-2 bg-[#24272c] text-white rounded-lg hover:bg-[#2a2d33] transition"
        >
          <BarChart3 size={18} className="flex-shrink-0" />
          {!sidebarCollapsed && <span>Dashboard</span>}
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-3">
        {!sidebarCollapsed && (
          <h3 className="text-xs uppercase text-gray-400 mb-2 mt-2">
            Conversations
          </h3>
        )}
        {conversations.length === 0 && !sidebarCollapsed && (
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
            onSelect={() => {
              if (renamingConvId !== conv.id) {
                onSelectConversation(conv.id);
                setMobileSidebarOpen(false);
              }
            }}
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
            sidebarCollapsed={sidebarCollapsed}
          />
        ))}
      </div>
    </aside>
  );
}
