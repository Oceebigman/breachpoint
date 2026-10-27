import { Shield, Crosshair, Trophy, Settings as Gear, ChevronRight, Zap } from 'lucide-react';

interface Props {
  onPlay: () => void;
  onPractice: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
}

// Curated Unsplash military/tactical images (free, no key required)
const HERO_BG =
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1600&q=80&fit=crop'; // soldier silhouette
const PANEL_BG =
  'https://images.unsplash.com/photo-1608096299210-db7e38487075?w=800&q=70&fit=crop'; // urban ruins

export function MainMenu({ onPlay, onPractice, onLeaderboard, onSettings }: Props) {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden bg-black">

      {/* Full-bleed hero image */}
      <div className="absolute inset-0">
        <img
          src={HERO_BG}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.45) saturate(1.3)' }}
        />
        {/* Dramatic gradient overlays */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(120deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.3) 100%)' }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 60%)' }} />
        {/* Scanline texture */}
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
          }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-6">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-[#ff6b00]" />
          <span className="text-[10px] tracking-[0.35em] text-[#ff6b00] font-mono uppercase font-bold">
            BREACHPOINT // TACTICAL FPS
          </span>
        </div>
        <div className="flex items-center gap-4 text-[#6a7a8a] text-[10px] font-mono tracking-widest">
          <span>IRONGATE MAP</span>
          <span className="text-[#ff6b00]">●</span>
          <span>PHASE 1</span>
        </div>
      </div>

      {/* Main content — left-aligned like CoD */}
      <div className="relative z-10 flex flex-1 items-end pb-16 px-8 md:px-16 lg:px-24">
        <div className="w-full max-w-sm">

          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3">
            <Crosshair size={12} className="text-[#ff6b00]" strokeWidth={2.5} />
            <span className="text-[10px] tracking-[0.4em] text-[#ff6b00] font-mono font-bold">TACTICAL BREACH MODE</span>
          </div>

          {/* Game title */}
          <div className="mb-1" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            <div className="text-white font-black leading-none"
              style={{ fontSize: 'clamp(3.5rem, 8vw, 6rem)', letterSpacing: '-0.04em', textShadow: '0 0 60px rgba(255,107,0,0.4)' }}>
              BREACH
            </div>
            <div className="font-black leading-none"
              style={{
                fontSize: 'clamp(3.5rem, 8vw, 6rem)',
                letterSpacing: '-0.04em',
                color: '#ff6b00',
                textShadow: '0 0 80px rgba(255,107,0,0.6), 0 4px 20px rgba(0,0,0,0.8)',
                marginTop: '-0.08em',
              }}>
              POINT
            </div>
          </div>

          <p className="text-[#8899aa] text-sm tracking-widest mb-8 font-mono uppercase">
            Secure the objective. Control the breach.
          </p>

          {/* CTA */}
          <button
            onClick={onPlay}
            className="group relative w-full mb-3 overflow-hidden"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            {/* Animated fill */}
            <div className="absolute inset-0 bg-[#ff6b00] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out" />
            <div className="absolute inset-0 border-2 border-[#ff6b00]" />
            <div className="relative flex items-center justify-between px-6 py-4 bg-[#ff6b00] group-hover:bg-transparent transition-colors duration-300">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
                <span className="text-black group-hover:text-white font-black text-lg tracking-wider transition-colors">
                  PLAY BREACH
                </span>
              </div>
              <ChevronRight size={22} className="text-black group-hover:text-white transition-colors group-hover:translate-x-1 duration-200" />
            </div>
          </button>

          {/* Secondary nav */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { label: 'PRACTICE', icon: <Zap size={14} />, action: onPractice, color: '#3a9bff' },
              { label: 'RANKS', icon: <Trophy size={14} />, action: onLeaderboard, color: '#ffd700' },
              { label: 'SETTINGS', icon: <Gear size={14} />, action: onSettings, color: '#8899aa' },
            ].map(({ label, icon, action, color }) => (
              <button
                key={label}
                onClick={action}
                className="flex flex-col items-center gap-1.5 px-2 py-3 border border-[#ffffff18] hover:border-[#ffffff44] bg-[#ffffff08] hover:bg-[#ffffff12] rounded-sm transition-all group"
              >
                <span style={{ color }} className="group-hover:scale-110 transition-transform">{icon}</span>
                <span className="text-[#8899aa] group-hover:text-white text-[9px] font-mono tracking-[0.2em] transition-colors">{label}</span>
              </button>
            ))}
          </div>

          {/* Small print */}
          <p className="text-[#3a4050] text-[10px] font-mono tracking-widest">
            v0.1-ALPHA · IRONGATE · NO ASSETS REQUIRED
          </p>
        </div>
      </div>

      {/* Right side accent image (desktop) */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none hidden md:block">
        <img
          src={PANEL_BG}
          alt=""
          className="w-full h-full object-cover object-left"
          style={{ filter: 'brightness(0.3) saturate(1.5) hue-rotate(-10deg)' }}
        />
        {/* Fade left */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #000 0%, transparent 40%)' }} />
        {/* Orange tint stripe */}
        <div className="absolute inset-y-0 left-0 w-px bg-[#ff6b00] opacity-60" />
      </div>
    </div>
  );
}
