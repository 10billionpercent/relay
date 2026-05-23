import React, { RefObject } from "react";
import {
  MessageCircle,
  Loader2,
  Check,
  X,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import type { Conversation } from "../types";

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  isLoading: boolean;
  isRenaming: boolean;
  renameTitle: string;
  setRenameTitle: (v: string) => void;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
  onStartRename: () => void;
  menuOpenConvId: string | null;
  setMenuOpenConvId: (id: string | null) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  sidebarCollapsed: boolean;
}

export default function ConversationItem({
  conv,
  isActive,
  isLoading,
  isRenaming,
  renameTitle,
  setRenameTitle,
  onSelect,
  onDelete,
  onRename,
  onStartRename,
  menuOpenConvId,
  setMenuOpenConvId,
  menuRef,
  sidebarCollapsed,
}: ConversationItemProps) {
  const isMenuOpen = menuOpenConvId === conv.id;

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1 transition ${
        isActive
          ? "bg-[#2a2d33] border-l-2 border-[#00cfff]"
          : "hover:bg-[#24272c]"
      } ${sidebarCollapsed ? "justify-center px-1" : ""}`}
    >
      {sidebarCollapsed ? (
        <MessageCircle size={18} className="text-gray-400" />
      ) : isLoading ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Loader2
            size={14}
            className="animate-spin text-gray-400 flex-shrink-0"
          />
          <span className="text-sm truncate">{conv.title}</span>
        </div>
      ) : isRenaming ? (
        <div
          className="flex items-center gap-1 flex-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            className="bg-[#24272c] border border-[#2a2d33] text-white text-sm rounded p-2 flex-1 min-w-0 focus:outline-none focus:border-[#00cfff]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRename();
              } else if (e.key === "Escape") {
                onSelect();
              }
            }}
          />
          <button
            onClick={onRename}
            className="p-0.5 rounded hover:bg-[#2a2d33] text-green-400 hover:text-green-300 transition"
            title="Confirm rename"
          >
            <Check size={16} />
          </button>
          <button
            onClick={onSelect}
            className="p-0.5 rounded hover:bg-[#2a2d33] text-gray-400 hover:text-red-400 transition"
            title="Cancel rename"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <span className="text-s truncate flex-1">{conv.title}</span>
      )}

      {!sidebarCollapsed && !isRenaming && (
        <div
          className="relative"
          ref={(isMenuOpen ? menuRef : undefined) as React.Ref<HTMLDivElement>}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenConvId(isMenuOpen ? null : conv.id);
            }}
            className="p-1 rounded hover:bg-[#2a2d33] text-gray-400 hover:text-white transition sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
            title="Chat settings"
          >
            <MoreHorizontal size={16} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-[#1a1d21] border border-[#2a2d33] rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename();
                }}
                className="w-full text-left px-3 py-2 text-s text-[#00cfff] hover:bg-[#24272c] flex items-center gap-2"
              >
                <Pencil size={14} /> Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-full text-left px-3 py-2 text-s text-red-400 hover:bg-[#24272c] flex items-center gap-2"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
