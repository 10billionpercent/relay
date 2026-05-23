import React from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, Pencil } from "lucide-react";
import type { Message } from "../types";

interface MessageBubbleProps {
  msg: Message;
  copiedId: string | null;
  onCopy: (content: string, id: string) => void;
  onEdit: (msg: Message) => void;
}

export default function MessageBubble({
  msg,
  copiedId,
  onCopy,
  onEdit,
}: MessageBubbleProps) {
  return (
    <div
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[70%] ${
          msg.role === "user"
            ? "flex flex-col items-end"
            : "flex flex-col items-start"
        }`}
      >
        <div
          className={`px-4 py-3 rounded-2xl break-words ${
            msg.role === "user"
              ? "bg-[#00cfff]/20 text-white rounded-br-sm"
              : "bg-[#24272c] text-white rounded-bl-sm shadow"
          }`}
        >
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
        <div
          className={`flex items-center gap-1 mt-1 px-1 ${
            msg.role === "user" ? "flex-row" : "flex-row"
          }`}
        >
          <button
            onClick={() => onCopy(msg.content, msg.id)}
            className="p-1 rounded hover:bg-[#2a2d33] text-gray-500 hover:text-gray-300 transition"
            title="Copy message"
          >
            {copiedId === msg.id ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
          {msg.role === "user" && (
            <button
              onClick={() => onEdit(msg)}
              className="p-1 rounded hover:bg-[#2a2d33] text-gray-500 hover:text-gray-300 transition"
              title="Edit message"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
