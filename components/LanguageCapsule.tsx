'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n, Language } from '@/components/I18nProvider';
import { Globe, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function LanguageCapsule() {
  const { language, setLanguage, toggleLanguage, t } = useI18n();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [isWaving, setIsWaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const triggerWaterWave = useCallback((e?: React.MouseEvent<HTMLElement>) => {
    // Generate ripple at click coordinate or center of button
    const rect = e?.currentTarget?.getBoundingClientRect();
    const x = rect && e ? e.clientX - rect.left : 80;
    const y = rect && e ? e.clientY - rect.top : 20;

    const newRipple: Ripple = {
      id: Date.now() + Math.random(),
      x,
      y
    };

    setRipples((prev) => [...prev.slice(-3), newRipple]);
    setIsWaving(true);

    // Auto clear ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 900);

    setTimeout(() => {
      setIsWaving(false);
    }, 1200);
  }, []);

  const handleSelectLanguage = (targetLang: Language, e: React.MouseEvent<HTMLButtonElement>) => {
    if (language !== targetLang) {
      triggerWaterWave(e);
      setLanguage(targetLang);
    } else {
      triggerWaterWave(e);
    }
  };

  const handleCapsuleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If user clicked the container background instead of specific button, toggle
    if ((e.target as HTMLElement).tagName !== 'BUTTON') {
      triggerWaterWave(e);
      toggleLanguage();
    }
  };

  return (
    <div 
      id="language-capsule-container"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 select-none pointer-events-auto"
    >
      {/* Dynamic Concentric Water Wave Rings */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.div
            key={ripple.id}
            initial={{ scale: 0.2, opacity: 0.8, borderWidth: '3px' }}
            animate={{ scale: 2.6, opacity: 0, borderWidth: '1px' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="absolute rounded-full border border-cyan-400/80 bg-cyan-400/10 pointer-events-none -z-10 shadow-[0_0_25px_rgba(6,182,212,0.4)]"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 140,
              height: 140,
              marginLeft: -70,
              marginTop: -70,
            }}
          />
        ))}
      </AnimatePresence>

      {/* Main Liquid Capsule */}
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCapsuleClick}
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "relative flex items-center gap-1.5 p-1.5 rounded-full border transition-all duration-300 shadow-2xl backdrop-blur-2xl cursor-pointer overflow-hidden group",
          "bg-neutral-950/85 border-white/15 hover:border-cyan-400/50 hover:shadow-cyan-500/20",
          isWaving && "border-cyan-400/70 shadow-[0_0_30px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/30"
        )}
      >
        {/* Liquid Wave Animated Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full opacity-40">
          <motion.div
            animate={{
              x: isWaving ? ['-50%', '0%', '-50%'] : ['0%', '-50%'],
              y: isWaving ? [0, -3, 0] : [0, 0],
            }}
            transition={{
              x: { duration: isWaving ? 2 : 7, repeat: Infinity, ease: 'linear' },
              y: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            }}
            className="absolute -inset-y-2 -left-[100%] w-[300%] flex"
          >
            {/* SVG Water Wave Geometry */}
            <svg 
              className="w-full h-full fill-cyan-500/20"
              viewBox="0 0 1200 120" 
              preserveAspectRatio="none"
            >
              <path d="M0,0 C150,90 350,-40 500,50 C650,140 900,-30 1200,40 L1200,120 L0,120 Z" />
            </svg>
          </motion.div>

          <motion.div
            animate={{
              x: isWaving ? ['0%', '-50%', '0%'] : ['-50%', '0%'],
            }}
            transition={{
              x: { duration: isWaving ? 2.5 : 9, repeat: Infinity, ease: 'linear' }
            }}
            className="absolute -inset-y-1 -left-[100%] w-[300%] flex opacity-50"
          >
            <svg 
              className="w-full h-full fill-emerald-500/20"
              viewBox="0 0 1200 120" 
              preserveAspectRatio="none"
            >
              <path d="M0,20 C200,100 400,-20 600,60 C800,140 1000,-10 1200,50 L1200,120 L0,120 Z" />
            </svg>
          </motion.div>
        </div>

        {/* Left Icon with Shimmer / Globe */}
        <div className="flex items-center pl-2.5 pr-1.5 py-1 text-cyan-400">
          <motion.div
            animate={isWaving ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.25, 1] } : { rotate: 0, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <Globe className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            {isWaving && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="w-2.5 h-2.5 text-emerald-300 animate-spin" />
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Language Options: ES & EN */}
        <div className="flex items-center gap-1 relative z-10 bg-white/[0.04] p-1 rounded-full border border-white/5">
          {/* Spanish Button */}
          <button
            id="lang-es-btn"
            type="button"
            onClick={(e) => handleSelectLanguage('es', e)}
            className={cn(
              "relative px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-1.5 cursor-pointer",
              language === 'es' 
                ? "text-white shadow-sm" 
                : "text-neutral-400 hover:text-white"
            )}
            title={t('spanish')}
          >
            {language === 'es' && (
              <motion.div
                layoutId="active-language-fluid-pill"
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-white/25 -z-10"
              />
            )}
            <span className="text-sm leading-none">🇪🇸</span>
            <span>ES</span>
            {language === 'es' && (
              <Check className="w-3 h-3 text-white/90 stroke-[2.5]" />
            )}
          </button>

          {/* English Button */}
          <button
            id="lang-en-btn"
            type="button"
            onClick={(e) => handleSelectLanguage('en', e)}
            className={cn(
              "relative px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-1.5 cursor-pointer",
              language === 'en' 
                ? "text-white shadow-sm" 
                : "text-neutral-400 hover:text-white"
            )}
            title={t('english')}
          >
            {language === 'en' && (
              <motion.div
                layoutId="active-language-fluid-pill"
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/80 to-blue-500/80 shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-white/25 -z-10"
              />
            )}
            <span className="text-sm leading-none">🇬🇧</span>
            <span>EN</span>
            {language === 'en' && (
              <Check className="w-3 h-3 text-white/90 stroke-[2.5]" />
            )}
          </button>
        </div>

        {/* Hover / Active Tooltip */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.92 }}
              className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-neutral-900/95 border border-cyan-400/40 text-[11px] font-medium text-cyan-200 shadow-xl backdrop-blur-md whitespace-nowrap pointer-events-none"
            >
              {language === 'es' ? '🇪🇸 Español activo (Clic para alternar)' : '🇬🇧 English active (Click to toggle)'}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
