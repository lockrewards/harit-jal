import React, { useEffect, useRef } from 'react';
import { ArrowRight, ShieldCheck, Box, PhoneCall } from 'lucide-react';
import { ChatMessage, NeerAction } from '../../types/neer';
import { soundPlayer } from '../../services/sound';

interface NeerMessageListProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onActionClick: (action: NeerAction) => void;
}

export const NeerMessageList: React.FC<NeerMessageListProps> = ({
  messages,
  isThinking,
  onActionClick,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 font-manrope text-xs sm:text-[13px]">
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fadeIn`}
          >
            {/* Sender Label & Avatar for Neer */}
            {!isUser && (
              <div className="flex items-center gap-1.5 mb-1 pl-1">
                <div className="w-4.5 h-4.5 rounded-full border border-[#C99B42]/50 bg-white p-0.5 flex items-center justify-center shadow-xs shrink-0">
                  <img
                    src="/images/brand/harit-jal-logo-mark.png"
                    alt="Neer AI"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[10px] font-bold text-[#52652D] uppercase tracking-wider">
                  Neer • AI Guide
                </span>
              </div>
            )}

            {/* Bubble Content */}
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3 sm:p-3.5 leading-relaxed shadow-xs ${
                isUser
                  ? 'bg-[#102C47] text-[#FFF9EF] rounded-tr-none border border-[#C99B42]/20'
                  : 'bg-[#FFF9EF] text-[#102C47] rounded-tl-none border border-[#C99B42]/35 shadow-[0_4px_16px_rgba(16,44,71,0.05)]'
              }`}
            >
              {/* Message text with formatted line breaks */}
              <div className="whitespace-pre-line">
                {msg.text}
              </div>

              {/* Source Citation Pill */}
              {msg.sourceCitation && (
                <div className="mt-2.5 pt-2 border-t border-[#C99B42]/20 flex items-center gap-1.5 text-[9.5px] text-[#52652D] font-semibold">
                  <ShieldCheck className="w-3 h-3 text-[#52652D] shrink-0" />
                  <span className="truncate">Verified: {msg.sourceCitation.title}</span>
                </div>
              )}

              {/* Action Buttons */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#C99B42]/20 flex flex-wrap gap-1.5">
                  {msg.suggestedActions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        soundPlayer.playWaterDrop();
                        onActionClick(act);
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#102C47] text-[#FFF9EF] hover:bg-[#183C60] text-[10.5px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                    >
                      {act.action === 'open_studio' && <Box className="w-2.5 h-2.5 text-[#C99B42]" />}
                      {act.action === 'book_call' && <PhoneCall className="w-2.5 h-2.5 text-[#C99B42]" />}
                      {act.action === 'navigate' && <ArrowRight className="w-2.5 h-2.5 text-[#C99B42]" />}
                      <span>{act.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Timestamp */}
            <span className="text-[9px] text-[#77766F] mt-1 px-1">
              {msg.timestamp}
            </span>
          </div>
        );
      })}

      {/* Animated Typing Indicator */}
      {isThinking && (
        <div className="flex flex-col items-start animate-fadeIn">
          <div className="flex items-center gap-1.5 mb-1 pl-1">
            <div className="w-4.5 h-4.5 rounded-full border border-[#C99B42]/50 bg-white p-0.5 flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/images/brand/harit-jal-logo-mark.png"
                alt="Neer AI"
                className="w-full h-full object-contain animate-pulse"
              />
            </div>
            <span className="text-[10px] font-bold text-[#52652D] uppercase tracking-wider">
              Neer is thinking...
            </span>
          </div>
          <div className="rounded-2xl rounded-tl-none bg-[#FFF9EF] border border-[#C99B42]/35 p-3 px-4 shadow-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#C99B42] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-[#52652D] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-[#102C47] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

