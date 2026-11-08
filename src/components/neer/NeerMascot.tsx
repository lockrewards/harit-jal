import React from 'react';

interface NeerMascotProps {
  isOpen: boolean;
  isWobbling: boolean;
  isBlinking: boolean;
  isThinking?: boolean;
  onClick: () => void;
}

export const NeerMascot: React.FC<NeerMascotProps> = ({
  isOpen,
  isWobbling,
  isBlinking,
  isThinking = false,
  onClick,
}) => {
  return (
    <div 
      onClick={onClick}
      className={`pointer-events-auto relative cursor-pointer group transition-all duration-300 ${
        isWobbling ? 'animate-wobble' : 'animate-mascot'
      }`}
      title={isOpen ? 'Click to minimize Neer' : 'Ask Neer AI — Harit Jal Water Guide!'}
    >
      {/* Thinking / Active Ripple Rings */}
      {isThinking && (
        <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
          <span className="absolute w-[85px] h-[85px] rounded-full border-2 border-[#52652D]/50 animate-ping opacity-75" />
          <span className="absolute w-[105px] h-[105px] rounded-full border border-[#C99B42]/40 animate-pulse opacity-50" />
        </div>
      )}

      {/* Triple Golden Water Reflection Base Rings */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[64px] h-3 rounded-full bg-[#C99B42]/35 blur-xs -z-10 group-hover:bg-[#C99B42]/60 transition-all" />
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[76px] h-2 rounded-full bg-[#52652D]/20 blur-sm -z-10" />

      {/* Mascot Droplet Container (Strict 70px width as requested) */}
      <div className="relative w-[70px] h-[84px] flex items-center justify-center filter drop-shadow-[0_8px_22px_rgba(16,44,71,0.28)] group-hover:scale-108 transition-transform duration-300">
        <svg viewBox="0 0 100 120" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="neerDropletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#FFF9EF" />
              <stop offset="65%" stopColor="#E2EEDF" />
              <stop offset="100%" stopColor="#52652D" />
            </linearGradient>

            <linearGradient id="handGradRight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF9EF" />
              <stop offset="50%" stopColor="#E2EEDF" />
              <stop offset="100%" stopColor="#52652D" />
            </linearGradient>

            <linearGradient id="handGradLeft" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF9EF" />
              <stop offset="50%" stopColor="#E2EEDF" />
              <stop offset="100%" stopColor="#52652D" />
            </linearGradient>

            <filter id="neerGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#102C47" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Cute Moving Hand on Left Side with Natural Curve */}
          <g className="animate-waveHandLeft origin-[23px_68px]">
            <path
              d="M 23 66 C 14 61 4 62 2 68 C 1 74 11 78 24 76 Z"
              fill="url(#handGradLeft)"
              stroke="#C99B42"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>

          {/* Cute Moving Hand on Right Side with Responsive Wave */}
          <g className="animate-waveHandRight origin-[77px_68px]">
            <path
              d="M 77 66 C 86 61 96 62 98 68 C 99 74 89 78 76 76 Z"
              fill="url(#handGradRight)"
              stroke="#C99B42"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>

          {/* Droplet Main Body with Gold Border & Rich Water Gradient */}
          <path
            d="M 50 10 C 50 10 20 45 20 75 C 20 95 33 110 50 110 C 67 110 80 95 80 75 C 80 45 50 10 50 10 Z"
            fill="url(#neerDropletGrad)"
            stroke="#C99B42"
            strokeWidth="2.6"
            filter="url(#neerGlow)"
          />

          {/* Internal Water Shimmer / Caustic Arc */}
          <path
            d="M 28 78 C 30 96 42 104 50 104 C 58 104 70 96 72 78"
            stroke="#C99B42"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            fill="none"
            opacity="0.4"
          />

          {/* Glossy Specular Highlights */}
          <circle cx="47" cy="28" r="3.2" fill="#FFFFFF" opacity="0.95" />
          <circle cx="53" cy="33" r="1.6" fill="#FFFFFF" opacity="0.75" />

          {/* Glossy Inner Curved Sheen Highlight on Left */}
          <path
            d="M 33 46 C 25 57 25 77 34 85"
            stroke="#FFFFFF"
            strokeWidth="4.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.88"
          />

          {/* Cute Emerald Leaf on Top Head with White Vein */}
          <g transform="rotate(12 50 12)">
            <path
              d="M 50 12 C 55 1 68 2 70 9 C 70 16 58 17 50 12 Z"
              fill="#52652D"
              stroke="#C99B42"
              strokeWidth="1.3"
            />
            {/* White Leaf Vein */}
            <path
              d="M 53 11 C 60 8 65 9 68 10"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
          </g>

          {/* Kawaii Anime Eyes with Dual Sparkling Highlights */}
          {isBlinking ? (
            <g stroke="#102C47" strokeWidth="2.6" strokeLinecap="round">
              <path d="M 32 68 Q 37 65 42 68" fill="none" />
              <path d="M 58 68 Q 63 65 68 68" fill="none" />
            </g>
          ) : isThinking ? (
            /* Concentrated Thinking Cute Eyes */
            <g>
              <ellipse cx="37" cy="65" rx="4.0" ry="4.5" fill="#102C47" />
              <circle cx="36" cy="63" r="1.6" fill="#FFFFFF" />
              <ellipse cx="61" cy="65" rx="4.0" ry="4.5" fill="#102C47" />
              <circle cx="60" cy="63" r="1.6" fill="#FFFFFF" />
              {/* Cute curious eyebrow lines */}
              <path d="M 33 58 Q 37 56 41 59" stroke="#102C47" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              <path d="M 59 59 Q 63 56 67 58" stroke="#102C47" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </g>
          ) : (
            /* Sparkly Open Eyes */
            <g>
              {/* Left Eye */}
              <ellipse cx="37" cy="67" rx="4.4" ry="6.0" fill="#102C47" />
              <circle cx="35.5" cy="64.2" r="2.0" fill="#FFFFFF" />
              <circle cx="39" cy="69.2" r="1.1" fill="#FFFFFF" />

              {/* Right Eye */}
              <ellipse cx="61" cy="67" rx="4.4" ry="6.0" fill="#102C47" />
              <circle cx="59.5" cy="64.2" r="2.0" fill="#FFFFFF" />
              <circle cx="63" cy="69.2" r="1.1" fill="#FFFFFF" />
            </g>
          )}

          {/* Soft Rosy Cheeks */}
          <ellipse cx="28" cy="74" rx="4.8" ry="2.4" fill="#f87171" opacity="0.75" />
          <ellipse cx="70" cy="74" rx="4.8" ry="2.4" fill="#f87171" opacity="0.75" />

          {/* Cute Open Joyful Mouth with Pink Tongue */}
          <path
            d="M 44 73 Q 49 83 54 73 Z"
            fill="#102C47"
          />
          <path
            d="M 46 76 Q 49 83 52 76 Z"
            fill="#F87171"
          />
        </svg>
      </div>

      {/* Prominent Badge when Closed */}
      {!isOpen && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#102C47] text-[#FFF9EF] text-[10px] font-bold border border-[#C99B42] shadow-md whitespace-nowrap flex items-center gap-1 group-hover:scale-105 transition-transform">
          <span>Neer</span>
          <span className="text-[9px] text-[#C99B42] font-devanagari">नीर</span>
          <span>💧</span>
        </div>
      )}
    </div>
  );
};
