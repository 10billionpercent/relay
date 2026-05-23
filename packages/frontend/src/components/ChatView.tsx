import React, { RefObject } from "react";
import { AlertTriangle, X, Pencil, Send, Square, Loader2 } from "lucide-react";
import type { Message, Model } from "../types";
import { MODEL_NAMES } from "../constants";
import ModelSelector from "./ModelSelector";
import MessageBubble from "./MessageBubble";

interface ChatViewProps {
  setSelectedModel: (m: string) => void;
  messages: Message[];
  user: { username: string } | null;
  selectedModel: string;
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  error: string | null;
  editingMessageId: string | null;
  onCancelEdit: () => void;
  copiedId: string | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  models: Model[];
  modelDropdownOpen: boolean;
  setModelDropdownOpen: (v: boolean) => void;
  modelDropdownRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onStop: () => void;
  onCopy: (content: string, id: string) => void;
  onEdit: (msg: Message) => void;
  title: string;
  loadingConversationId: string | null;
  onDismissError: () => void;
}

export default function ChatView({
  setSelectedModel,
  messages,
  user,
  selectedModel,
  input,
  setInput,
  loading,
  error,
  editingMessageId,
  onCancelEdit,
  copiedId,
  textareaRef,
  messagesEndRef,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
  modelDropdownRef,
  onKeyDown,
  onSend,
  onStop,
  onCopy,
  onEdit,
  title,
  loadingConversationId,
  onDismissError,
}: ChatViewProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-20 text-gray-400">
            <img src="/relay.png" alt="Relay" className="w-40 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Hi, {user?.username}
            </h1>
            <p>Chat with AI using Groq's fast inference</p>
            <p className="mt-2">
              Current model:{" "}
              <strong className="text-[#00cfff]" title={selectedModel}>
                {MODEL_NAMES[selectedModel] || selectedModel}
              </strong>
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            copiedId={copiedId}
            onCopy={onCopy}
            onEdit={onEdit}
          />
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
        <div ref={messagesEndRef as React.Ref<HTMLDivElement>} />
      </div>

      {error && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="text-sm break-words">{error}</span>
          </div>
          <button onClick={onDismissError} className="flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="p-3 sm:p-4 border-t border-[#2a2d33] bg-[#1a1d21]">
        <div className="flex flex-col gap-2">
          {editingMessageId && (
            <div className="flex items-center gap-2 text-xs text-[#00cfff]">
              <Pencil size={12} />
              <span>Editing message</span>
              <button
                onClick={onCancelEdit}
                className="ml-auto text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <ModelSelector
            setSelectedModel={setSelectedModel}
            selectedModel={selectedModel}
            models={models}
            modelDropdownOpen={modelDropdownOpen}
            setModelDropdownOpen={setModelDropdownOpen}
            modelDropdownRef={modelDropdownRef}
          />
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef as React.Ref<HTMLTextAreaElement>}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Message ${MODEL_NAMES[selectedModel] || selectedModel}`}
              rows={1}
              disabled={loading}
              className="flex-1 bg-[#24272c] border border-[#2a2d33] rounded-lg p-3 text-white resize-none focus:outline-none focus:border-[#00cfff] text-s"
              style={{ minHeight: "44px", maxHeight: "224px" }}
            />
            {loading ? (
              <button
                onClick={onStop}
                className="flex-shrink-0 p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                title="Stop generating"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={onSend}
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
  );
}
