import React, { RefObject } from "react";
import { ChevronDown } from "lucide-react";
import type { Model } from "../types";
import { MODEL_NAMES } from "../constants";

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  models: Model[];
  modelDropdownOpen: boolean;
  setModelDropdownOpen: (v: boolean) => void;
  modelDropdownRef: RefObject<HTMLDivElement | null>;
}

export default function ModelSelector({
  selectedModel,
  setSelectedModel,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
  modelDropdownRef,
}: ModelSelectorProps) {
  return (
    <div
      className="relative w-48 sm:w-56"
      ref={modelDropdownRef as React.Ref<HTMLDivElement>}
    >
      <button
        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
        className="w-full flex items-center justify-between bg-[#24272c] border border-[#2a2d33] text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00cfff]"
      >
        <span className="truncate">
          {MODEL_NAMES[selectedModel] || selectedModel}
        </span>
        <ChevronDown
          size={12}
          className={`ml-2 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`}
        />
      </button>
      {modelDropdownOpen && (
        <div className="absolute z-50 bottom-full mb-1 w-full bg-[#1a1d21] border border-[#2a2d33] rounded-lg shadow-lg overflow-hidden">
          {models.map((m) => (
            <button
              key={m.model}
              onClick={() => {
                setSelectedModel(m.model);
                setModelDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#24272c] transition ${
                m.model === selectedModel
                  ? "bg-[#24272c] border-l-2 border-[#00cfff] text-[#00cfff]"
                  : "text-gray-300"
              }`}
              title={m.model}
            >
              {MODEL_NAMES[m.model] || m.model}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
