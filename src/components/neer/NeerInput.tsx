import React, { useState } from 'react';
import { Send, Droplets } from 'lucide-react';
import { soundPlayer } from '../../services/sound';

interface NeerInputProps {
  onSendMessage: (text: string) => void;
  isThinking: boolean;
  suggestedPrompts: string[];
}

export const NeerInput: React.FC<NeerInputProps> = ({
  onSendMessage,
  isThinking,
  suggestedPrompts,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean || isThinking) return;

    soundPlayer.playWaterDrop();
    onSendMessage(clean);
    setInputText('');
  };

  const handlePromptClick = (prompt: string) => {
    soundPlayer.playWaterDrop();
    onSendMessage(prompt);
  };

  return (
    <div className="p-3 bg-[#FFF9EF] border-t border-[#C99B42]/25 font-manrope">
      {/* Suggested Quick Prompt Chips */}
      {suggestedPrompts.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-[10.5px]">
          <span className="shrink-0 text-[#52652D] font-bold flex items-center gap-1 pl-1">
            <Droplets className="w-3 h-3 text-[#C99B42]" />
            <span>Ask:</span>
          </span>
          {suggestedPrompts.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handlePromptClick(p)}
              disabled={isThinking}
              className="shrink-0 px-2.5 py-1 rounded-full bg-[#F8F3E9] hover:bg-[#102C47] hover:text-[#FFF9EF] text-[#102C47] border border-[#C99B42]/30 transition text-[11px] font-semibold cursor-pointer shadow-xs active:scale-95"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input Field and Send Button */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Neer about bottles, pricing, delivery, BIS standards..."
          disabled={isThinking}
          className="flex-1 px-3.5 py-2.5 rounded-full bg-white border border-[#C99B42]/40 text-xs text-[#102C47] placeholder:text-[#77766F]/70 focus:outline-none focus:ring-1 focus:ring-[#C99B42] focus:border-[#C99B42] transition shadow-inner"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isThinking}
          className={`p-2.5 rounded-full flex items-center justify-center transition shadow-sm ${
            inputText.trim() && !isThinking
              ? 'btn-gold-luxury cursor-pointer active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          title="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

