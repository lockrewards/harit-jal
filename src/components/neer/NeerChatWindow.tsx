import React, { useEffect } from 'react';
import { Volume2, VolumeX, X, RotateCcw } from 'lucide-react';
import { ChatMessage, NeerAction } from '../../types/neer';
import { NeerMessageList } from './NeerMessageList';
import { NeerInput } from './NeerInput';
import { soundPlayer } from '../../services/sound';
import { AutomationService } from '../../services/automationService';

interface NeerChatWindowProps {
  messages: ChatMessage[];
  isThinking: boolean;
  isMuted: boolean;
  currentPageTitle: string;
  suggestedPrompts: string[];
  onSendMessage: (text: string) => void;
  onActionClick: (action: NeerAction) => void;
  onToggleMute: () => void;
  onClearHistory: () => void;
  onClose: () => void;
}

export const NeerChatWindow: React.FC<NeerChatWindowProps> = ({
  messages,
  isThinking,
  isMuted,
  currentPageTitle,
  suggestedPrompts,
  onSendMessage,
  onActionClick,
  onToggleMute,
  onClearHistory,
  onClose,
}) => {
  // Check and flush partial leads older than 5 minutes every 60s
  useEffect(() => {
    AutomationService.flushPartialLeads();
    const interval = setInterval(() => {
      AutomationService.flushPartialLeads();
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="pointer-events-auto w-[calc(100vw-2rem)] sm:w-[390px] max-w-[390px] h-[540px] max-h-[calc(100dvh-5.5rem)] flex flex-col rounded-2xl sm:rounded-3xl bg-[#F8F3E9] border border-[#C99B42]/45 shadow-[0_20px_50px_rgba(16,44,71,0.22)] backdrop-blur-xl overflow-hidden font-manrope text-[#102C47] animate-fadeIn relative">
      
      {/* Top Header */}
      <div className="px-4 py-3 bg-[#FFF9EF] border-b border-[#C99B42]/30 flex items-center justify-between shrink-0">
        
        {/* Brand & Guide Info */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full border border-[#C99B42]/60 bg-white p-1 flex items-center justify-center shadow-xs relative shrink-0">
            <img
              src="/images/brand/harit-jal-logo-mark.png"
              alt="Harit Jal Neer AI"
              className="w-full h-full object-contain filter drop-shadow-xs"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#52652D] border-2 border-white animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-bold text-sm text-[#102C47] font-playfair">
                Neer AI 2.0
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#52652D]/15 text-[#52652D] font-devanagari">
                नीर
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] text-[#77766F]">
              <span className="text-[#52652D] font-bold">Online</span>
              <span>•</span>
              <span className="truncate max-w-[130px] font-medium">Viewing: {currentPageTitle}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 text-[#77766F]">
          <button
            onClick={() => {
              soundPlayer.playBubblePop();
              onToggleMute();
            }}
            className="p-1.5 rounded-lg hover:bg-[#102C47]/10 hover:text-[#102C47] transition cursor-pointer"
            title={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5 text-[#52652D]" />}
          </button>

          <button
            onClick={() => {
              soundPlayer.playBubblePop();
              onClearHistory();
            }}
            className="p-1.5 rounded-lg hover:bg-[#102C47]/10 hover:text-[#102C47] transition cursor-pointer"
            title="Clear conversation history"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              soundPlayer.playBubblePop();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-[#102C47]/10 hover:text-[#102C47] transition cursor-pointer"
            title="Minimize Neer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Messages Scroll Area */}
      <NeerMessageList
        messages={messages}
        isThinking={isThinking}
        onActionClick={onActionClick}
      />

      {/* Input & Suggested Chips Bar */}
      <NeerInput
        onSendMessage={onSendMessage}
        isThinking={isThinking}
        suggestedPrompts={suggestedPrompts}
      />

    </div>
  );
};

