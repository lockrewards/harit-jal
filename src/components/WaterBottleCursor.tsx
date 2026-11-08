import React, { useEffect, useRef, useState, useCallback } from 'react';
import { soundPlayer } from '../services/sound';

interface RippleDroplet {
  dx: number;
  dy: number;
  color: string;
  size: number;
}

interface ActiveRipple {
  id: number;
  x: number;
  y: number;
  droplets: RippleDroplet[];
}

const CURSOR_IMAGES = {
  default: '/images/cursor/harit-jal-cursor-default.png',
  hover: '/images/cursor/harit-jal-cursor-hover.png',
  click: '/images/cursor/harit-jal-cursor-click.png',
};

// Check if current device supports fine pointer (mouse/trackpad, not touch)
const isFinePointer = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
};

// Check if user prefers reduced motion
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Check if an element or any of its ancestors is interactive
const isInteractiveElement = (element: Element | null): boolean => {
  if (!element) return false;
  return !!element.closest(
    'a, button, input, textarea, select, label, ' +
    '[role="button"], [role="link"], [role="checkbox"], [role="tab"], ' +
    '.cursor-pointer, [data-interactive="true"], summary, ' +
    '[tabindex]:not([tabindex="-1"]), [data-card]'
  );
};

export const WaterBottleCursor: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [cursorState, setCursorState] = useState<'default' | 'hover' | 'click'>('default');
  const [ripples, setRipples] = useState<ActiveRipple[]>([]);

  // Refs for high-performance 120Hz/144Hz movement without React re-renders
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const isMouseDownRef = useRef(false);
  const isHoveringRef = useRef(false);
  const rafId = useRef<number | null>(null);

  // Preload all 3 cursor assets immediately to prevent flickering
  useEffect(() => {
    Object.values(CURSOR_IMAGES).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Check hardware pointer capability on mount and on resize
  useEffect(() => {
    const checkCapability = () => {
      const fine = isFinePointer();
      setIsEnabled(fine);
      if (fine) {
        document.body.classList.add('custom-cursor-active');
      } else {
        document.body.classList.remove('custom-cursor-active');
      }
    };

    checkCapability();
    window.addEventListener('resize', checkCapability);

    return () => {
      window.removeEventListener('resize', checkCapability);
      document.body.classList.remove('custom-cursor-active');
    };
  }, []);

  // Update cursor position smoothly with requestAnimationFrame
  const updateCursorTransform = useCallback(() => {
    if (cursorRef.current) {
      const { x, y } = mousePos.current;
      // Hotspot offset:
      // Default: Arrow tip is located at (1.2px, 0.1px) from top-left of image
      // Hover/Click: Slight offset to keep bottle beside target without obscuring it
      let offsetX = -1;
      let offsetY = 0;

      if (cursorState === 'hover') {
        offsetX = -10;
        offsetY = -6;
      } else if (cursorState === 'click') {
        offsetX = -10;
        offsetY = -4;
      }

      cursorRef.current.style.transform = `translate3d(${x + offsetX}px, ${y + offsetY}px, 0)`;
    }
  }, [cursorState]);

  // Main mouse and interaction event handlers
  useEffect(() => {
    if (!isEnabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;

      if (!isVisible) {
        setIsVisible(true);
        document.body.classList.add('custom-cursor-active');
      }

      // Check if hovered element is interactive
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const interactive = isInteractiveElement(target);
      isHoveringRef.current = interactive;

      // Update state if not actively clicking
      if (!isMouseDownRef.current) {
        setCursorState(interactive ? 'hover' : 'default');
      }

      // Schedule hardware-accelerated transform update
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(updateCursorTransform);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only trigger for left-click
      isMouseDownRef.current = true;
      setCursorState('click');

      // Create gentle water ripple & splash particles
      const newRippleId = Date.now() + Math.random();
      const dropletColors = ['#0284c7', '#38bdf8', '#7dd3fc', '#0ea5e9', '#C99B42'];
      const droplets: RippleDroplet[] = Array.from({ length: 6 }).map((_, i) => {
        const angle = (i * 60 + (Math.random() * 20 - 10)) * (Math.PI / 180);
        const distance = 16 + Math.random() * 22;
        return {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          color: dropletColors[i % dropletColors.length],
          size: 3 + Math.random() * 3,
        };
      });

      setRipples((prev) => [...prev.slice(-5), { id: newRippleId, x: e.clientX, y: e.clientY, droplets }]);

      // Trigger subtle water drop audio chime
      soundPlayer.playWaterDrop();

      // Clean up ripple after animation finishes (650ms)
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRippleId));
      }, 650);

      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(updateCursorTransform);
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
      // Revert to hover if still on interactive target, else default
      setCursorState(isHoveringRef.current ? 'hover' : 'default');

      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(updateCursorTransform);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
      document.body.classList.remove('custom-cursor-active');
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
      document.body.classList.add('custom-cursor-active');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsVisible(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isEnabled, isVisible, updateCursorTransform]);

  // If fine pointer is not available (mobile/touch), do not render custom cursor
  if (!isEnabled) {
    return null;
  }

  const reducedMotion = prefersReducedMotion();

  return (
    <>
      {/* 1. Water Ripple and Splash Particles Container */}
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden z-[99998]"
        aria-hidden="true"
      >
        {ripples.map((ripple) => (
          <div key={ripple.id}>
            {/* Primary expanding water ring */}
            <div
              className="absolute rounded-full border border-[#0284c7] pointer-events-none"
              style={{
                left: `${ripple.x}px`,
                top: `${ripple.y}px`,
                width: '32px',
                height: '32px',
                animation: 'cursorRipple 550ms cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
                backgroundColor: 'rgba(56, 189, 248, 0.18)',
              }}
            />

            {/* Secondary champagne gold sparkle ring */}
            <div
              className="absolute rounded-full border border-[#C99B42]/70 pointer-events-none"
              style={{
                left: `${ripple.x}px`,
                top: `${ripple.y}px`,
                width: '20px',
                height: '20px',
                animation: 'cursorSecondaryRipple 450ms ease-out forwards',
              }}
            />

            {/* Water droplet splash particles radiating outward */}
            {!reducedMotion &&
              ripple.droplets.map((d, index) => (
                <div
                  key={index}
                  className="absolute rounded-full pointer-events-none shadow-xs"
                  style={{
                    left: `${ripple.x}px`,
                    top: `${ripple.y}px`,
                    width: `${d.size}px`,
                    height: `${d.size}px`,
                    backgroundColor: d.color,
                    // Pass splash displacement variables for CSS animation
                    ['--splash-dx' as string]: `${d.dx}px`,
                    ['--splash-dy' as string]: `${d.dy}px`,
                    animation: 'cursorSplashDroplet 500ms ease-out forwards',
                  }}
                />
              ))}
          </div>
        ))}
      </div>

      {/* 2. Custom Animated Water Bottle Cursor */}
      <div
        ref={cursorRef}
        className={`fixed top-0 left-0 pointer-events-none z-[99999] will-change-transform transition-opacity duration-150 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          transform: `translate3d(${mousePos.current.x - 1}px, ${mousePos.current.y}px, 0)`,
        }}
        aria-hidden="true"
      >
        <div
          className={`relative transition-all duration-200 select-none ${
            cursorState === 'hover' && !reducedMotion ? 'animate-cursor-hover' : ''
          }`}
          style={{
            transform: cursorState === 'click' ? 'scale(0.92)' : 'scale(1)',
          }}
        >
          {/* Default State: Open smiling eyes, thumbs-up, top-left black pointer arrow */}
          <img
            src={CURSOR_IMAGES.default}
            alt=""
            draggable={false}
            className={`w-[46px] h-auto object-contain transition-all duration-150 drop-shadow-[0_4px_10px_rgba(16,44,71,0.22)] ${
              cursorState === 'default' ? 'block' : 'hidden'
            }`}
          />

          {/* Hover State: Winking mascot with golden aura glow & water ripples */}
          <img
            src={CURSOR_IMAGES.hover}
            alt=""
            draggable={false}
            className={`w-[48px] h-auto object-contain transition-all duration-150 filter drop-shadow-[0_0_12px_rgba(201,155,66,0.65)] ${
              cursorState === 'hover' ? 'block' : 'hidden'
            }`}
          />

          {/* Click State: Closed joyful smiling eyes (^‿^), exclamation burst sparks */}
          <img
            src={CURSOR_IMAGES.click}
            alt=""
            draggable={false}
            className={`w-[48px] h-auto object-contain transition-all duration-150 filter drop-shadow-[0_0_14px_rgba(2,132,199,0.55)] ${
              cursorState === 'click' ? 'block' : 'hidden'
            }`}
          />
        </div>
      </div>
    </>
  );
};

