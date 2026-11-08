import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../../router/RouterContext';
import { soundPlayer } from '../../services/sound';
import { NeerAIService } from '../../services/neerAI';
import { ChatMessage, ConversationContext, NeerAction } from '../../types/neer';
import { NeerMascot } from './NeerMascot';
import { NeerChatWindow } from './NeerChatWindow';

interface NeerWidgetProps {
  onOpenBookingModal?: () => void;
}

const CHAT_STORAGE_KEY = 'harit_jal_neer_chat_history_v2';

const PAGE_TITLE_MAP: Record<string, string> = {
  '/': 'Home',
  '/gallery': 'Product Gallery',
  '/collections': 'Bespoke Collections',
  '/how-it-works': 'Supply Journey',
  '/contact': 'Consultation & Contact',
  '/compliance': 'BIS & FSSAI Standards',
  '/track': 'Partner Order Portal',
};

export const NeerWidget: React.FC<NeerWidgetProps> = ({ onOpenBookingModal }) => {
  const { currentPath, navigate } = useRouter();
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  // Default state: Closed so it never obstructs content
  const [isOpen, setIsOpen] = useState(false);
  const [isWobbling, setIsWobbling] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(soundPlayer.getMuted());

  // Conversation Context
  const [context, setContext] = useState<ConversationContext>({
    language: 'english',
    currentPage: currentPath,
  });

  // Chat History
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }

    return [
      {
        id: 'msg-welcome-01',
        sender: 'assistant',
        text: `Namaste! I am Neer 💧 Harit Jal's AI Water Guide.\n\nWe craft bespoke drinking water bottles branded exclusively in your restaurant or hotel's name. Ask me about custom designs, wholesale pricing, Bottle Gallery, delivery corridors, or BIS IS:14543 standards!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: 'english',
        suggestedActions: [
          { label: 'View Bottle Gallery', action: 'navigate', payload: '/gallery' },
          { label: 'Book Discovery Call', action: 'book_call' },
        ],
      },
    ];
  });

  // Sync messages to session storage so history is preserved across page navigations
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore
    }
  }, [messages]);

  // Update current page in context
  useEffect(() => {
    setContext((prev) => ({ ...prev, currentPage: currentPath }));
  }, [currentPath]);

  // Blinking eyes animation timer
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 4200);
    return () => clearInterval(blinkInterval);
  }, []);

  /**
   * CRITICAL REQUIREMENT: Click Anywhere Else on Website to Auto-Collapse
   * If customer clicks navigation links, product cards, CTA buttons, forms, or any section,
   * automatically collapse the chatbot back to only the small mascot.
   * CONVERSATION HISTORY REMAINS FULLY PRESERVED.
   */
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (!isOpen) return;

      // If the click is outside our widget container, collapse chat
      if (widgetContainerRef.current && !widgetContainerRef.current.contains(e.target as Node)) {
        soundPlayer.playBubblePop();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [isOpen]);

  const handleMascotClick = () => {
    setIsWobbling(true);
    setTimeout(() => setIsWobbling(false), 600);

    if (!isOpen) {
      soundPlayer.playWaterDrop();
      setIsOpen(true);
    } else {
      soundPlayer.playBubblePop();
      setIsOpen(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const { response, updatedContext } = await NeerAIService.processMessage(text, messages, context);
      setContext(updatedContext);

      setTimeout(() => {
        setIsThinking(false);
        soundPlayer.playSuccessChime();
        setMessages((prev) => [...prev, response]);
      }, 450);
    } catch (err) {
      console.error('Neer AI error:', err);
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: 'I had a momentary hiccup retrieving that data! Please ask again or feel free to book a direct consultation call with our team.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const handleActionClick = (action: NeerAction) => {
    switch (action.action) {
      case 'navigate':
        if (action.payload) {
          navigate(action.payload);
          NeerAIService.recordConversion('collectionsViewed');
        }
        break;

      case 'open_gallery':
      case 'open_studio':
        navigate('/gallery');
        NeerAIService.recordConversion('studioClicks');
        break;

      case 'book_call':
        if (onOpenBookingModal) {
          onOpenBookingModal();
          NeerAIService.recordConversion('consultationClicks');
        }
        break;

      case 'query':
        if (action.payload) {
          handleSendMessage(action.payload);
        }
        break;
    }
  };

  const handleToggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    soundPlayer.setMuted(newMute);
  };

  const handleClearHistory = () => {
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: 'assistant',
        text: 'Conversation cleared! How can I assist you with your restaurant water bottle requirements today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: context.language,
        suggestedActions: [
          { label: 'View Bottle Gallery', action: 'navigate', payload: '/gallery' },
          { label: 'Book Discovery Call', action: 'book_call' },
        ],
      },
    ]);
  };

  // Dynamic suggested prompts based on current page
  const getContextualPrompts = (): string[] => {
    switch (currentPath) {
      case '/gallery':
      case '/collections':
        return [
          '500ml flint glass bottle details?',
          'Dhabas ke liye best bottle kaunsi hai?',
          'Wholesale pricing vs menu profit?',
        ];
      case '/how-it-works':
        return [
          'Sample verification me kitna time lagta hai?',
          'Do you collect empty used bottles?',
          'Cellar delivery schedule kya hai?',
        ];
      case '/compliance':
        return [
          'BIS IS:14543 standard kya hai?',
          'FSSAI food safety license details',
          'Plastic waste EPR recycling process',
        ];
      case '/track':
        return [
          'Live order tracking kaise kaam karti hai?',
          'Where is Order ORD-HJ-8910?',
          'Driver contact & dispatch truck details',
        ];
      default:
        return [
          '500ml bottle kitne ki padegi?',
          'Can I see bottle photos with my logo?',
          'Do you supply to Bihar/Punjab?',
          'What is BIS IS:14543 certification?',
        ];
    }
  };

  const currentPageTitle = PAGE_TITLE_MAP[currentPath] || 'Harit Jal';

  return (
    <div 
      ref={widgetContainerRef}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end select-none font-manrope pointer-events-none"
    >
      {/* Expanded Full AI Chat Window */}
      {isOpen && (
        <div className="mb-3">
          <NeerChatWindow
            messages={messages}
            isThinking={isThinking}
            isMuted={isMuted}
            currentPageTitle={currentPageTitle}
            suggestedPrompts={getContextualPrompts()}
            onSendMessage={handleSendMessage}
            onActionClick={handleActionClick}
            onToggleMute={handleToggleMute}
            onClearHistory={handleClearHistory}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      {/* Floating Mascot Button */}
      <NeerMascot
        isOpen={isOpen}
        isWobbling={isWobbling}
        isBlinking={isBlinking}
        isThinking={isThinking}
        onClick={handleMascotClick}
      />
    </div>
  );
};

