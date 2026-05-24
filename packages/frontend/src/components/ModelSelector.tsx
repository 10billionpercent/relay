import React, { RefObject } from "react";
import { ChevronDown } from "lucide-react";
import type { Model } from "../types";
import { MODELS } from "../constants";

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
        className="w-full flex items-center justify-between bg-[#24272c] border border-[#2a2d33] text-white text-s rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00cfff]"
      >
        <span className="truncate">
          {MODELS[selectedModel]?.name || selectedModel}
        </span>
        <ChevronDown
          size={12}
          className={`ml-2 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`}
        />
      </button>
      {modelDropdownOpen && (
        <div className="absolute z-50 bottom-full mb-1 w-64 sm:w-[600px] max-w-[90vw] bg-[#1a1d21] border border-[#2a2d33] rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 p-1 max-h-[60vh] overflow-y-auto model-dropdown-scroll">
            {models.map((m) => (
              <button
                key={m.model}
                onClick={() => {
                  setSelectedModel(m.model);
                  setModelDropdownOpen(false);
                }}
                className={`text-left px-2 py-2 rounded hover:bg-[#24272c] transition ${
                  m.model === selectedModel
                    ? "bg-[#24272c] border-l-2 border-[#00cfff] text-[#00cfff]"
                    : "text-gray-300 border-l-2 border-transparent"
                }`}
                title={m.model}
              >
                <span className="text-s font-medium">
                  {MODELS[m.model]?.name || m.model}
                </span>
                {/* Fancy separator – tiny colored dot */}
                <span className="inline-flex items-center mx-1 align-middle">
                  <span
                    className={`w-1.5 h-1.5 rounded-full opacity-60 ${
                      m.model === selectedModel ? "bg-[#00cfff]" : "bg-white"
                    }`}
                  />
                </span>
                <span className="text-xs text-gray-400">
                  {MODELS[m.model]?.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
