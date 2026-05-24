import React from "react";
import { Menu, Loader2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import ChatView from "../components/ChatView";
import type { Message, Conversation, Model, UserData } from "../types";

interface ChatPageProps {
  user: UserData;
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  error: string | null;
  showDashboard: boolean;
  stats: any;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  models: Model[];
  modelDropdownOpen: boolean;
  setModelDropdownOpen: (v: boolean) => void;
  modelDropdownRef: React.RefObject<HTMLDivElement | null>;
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
  menuRef: React.RefObject<HTMLDivElement | null>;
  loadingConversationId: string | null;
  copiedId: string | null;
  editingMessageId: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDashboard: () => void;
  onLogout: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onSend: () => void;
  onStop: () => void;
  onCopy: (content: string, id: string) => void;
  onEdit: (msg: Message) => void;
  onCancelEdit: () => void;
  onDismissError: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export default function ChatPage(props: ChatPageProps) {
  const currentConversationTitle = props.currentConversationId
    ? props.conversations.find((c) => c.id === props.currentConversationId)
        ?.title || "Untitled"
    : "New Conversation";

  return (
    <div
      className="h-dvh flex bg-[#111315] text-white"
      style={{ fontFamily: "'Radio Canada', sans-serif", fontWeight: "500" }}
    >
      {props.mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => props.setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={props.user}
        conversations={props.conversations}
        currentConversationId={props.currentConversationId}
        sidebarCollapsed={props.sidebarCollapsed}
        setSidebarCollapsed={props.setSidebarCollapsed}
        mobileSidebarOpen={props.mobileSidebarOpen}
        setMobileSidebarOpen={props.setMobileSidebarOpen}
        serverDown={props.serverDown}
        renamingConvId={props.renamingConvId}
        setRenamingConvId={props.setRenamingConvId}
        renameTitle={props.renameTitle}
        setRenameTitle={props.setRenameTitle}
        menuOpenConvId={props.menuOpenConvId}
        setMenuOpenConvId={props.setMenuOpenConvId}
        menuRef={props.menuRef}
        loadingConversationId={props.loadingConversationId}
        onSelectConversation={props.onSelectConversation}
        onNewConversation={props.onNewConversation}
        onDashboard={props.onDashboard}
        onLogout={props.onLogout}
        onDeleteConversation={props.onDeleteConversation}
        onRenameConversation={props.onRenameConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center h-16 px-4 border-b border-[#2a2d33] bg-[#1a1d21] lg:px-6">
          <button
            onClick={() => props.setMobileSidebarOpen(true)}
            className="lg:hidden mr-3 text-gray-400 hover:text-white flex-shrink-0"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold truncate">
            {props.showDashboard
              ? "Analytics Dashboard"
              : currentConversationTitle}
          </h1>
          {props.loadingConversationId && (
            <Loader2 size={16} className="animate-spin ml-3 text-gray-400" />
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {props.showDashboard && props.stats ? (
            <Dashboard
              stats={props.stats}
              onRefresh={props.onDashboard}
              isGuest={props.user?.id === "guest"}
            />
          ) : (
            <ChatView
              setSelectedModel={props.setSelectedModel}
              messages={props.messages}
              user={props.user}
              selectedModel={props.selectedModel}
              input={props.input}
              setInput={props.setInput}
              loading={props.loading}
              error={props.error}
              editingMessageId={props.editingMessageId}
              onCancelEdit={props.onCancelEdit}
              copiedId={props.copiedId}
              textareaRef={props.textareaRef}
              messagesEndRef={props.messagesEndRef}
              models={props.models}
              modelDropdownOpen={props.modelDropdownOpen}
              setModelDropdownOpen={props.setModelDropdownOpen}
              modelDropdownRef={props.modelDropdownRef as any}
              onKeyDown={props.onKeyDown}
              onSend={props.onSend}
              onStop={props.onStop}
              onCopy={props.onCopy}
              onEdit={props.onEdit}
              title={currentConversationTitle}
              loadingConversationId={props.loadingConversationId}
              onDismissError={props.onDismissError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
