import { useState } from 'react';
import { ArrowLeft, Crosshair, Bot, Users, Zap, Target, Flame } from 'lucide-react';
import { BotDifficulty } from '../game/bots';
import { WeaponId } from '../game/weapons';

interface Props {
  isPractice: boolean;
  onStart: (config: { botCount: number; difficulty: BotDifficulty; playerName: string; weapon: WeaponId; team: 0 | 1 }) => void;
  onBack: () => void;
}

const WEAPONS: { id: WeaponId; label: string; sub: string; icon: string; color: string }[] = [
  { id: 'rifle',     label: 'AR-7 ASSAULT',  sub: 'Balanced · Full-auto',         icon: '⟩⟩', color: '#3a9bff' },
  { id: 'smg',       label: 'VX-4 SMG',      sub: 'Close range · High RPM',       icon: '≋≋', color: '#ff6b00' },
  { id: 'heavy',     label: 'LMG-12 HEAVY',  sub: 'Suppression · Large mag',      icon: '███', color: '#e84855' },
  { id: 'pistol',    label: 'MX-9 SIDEARM',  sub: 'Fast draw · Backup',           icon: '▶', color: '#44cc88' },
  { id: 'precision', label: 'SR-1 PRECISION', sub: 'Long range · Semi-auto',      icon: '◉', color: '#ffd700' },
];

// Battlefield images from Unsplash
const BG_IMG = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1400&q=70&fit=crop';

export function LobbySetup({ isPractice, onStart, onBack }: Props) {
  const [name, setName]         = useState('OPERATOR');
  const [botCount, setBotCount] = useState(4);
  const [difficulty, setDiff]   = useState<BotDifficulty>('normal');
  const [weapon, setWeapon]     = useState<WeaponId>('rifle');
  const [team, setTeam]         = useState<0 | 1>(0);

  const selectedWeapon = WEAPONS.find(w => w.id === weapon)!;

  return (
    <div className="min-h-dvh bg-black flex flex-col relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0">
        <img src={BG_IMG} alt="" className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.25) saturate(1.4)' }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0.5) 100%)' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center gap-4 px-6 pt-6 pb-4 border-b border-[#ffffff12]">
        <button
          onClick={onBack}
          className="p-2 border border-[#ffffff20] text-[#8899aa] hover:border-[#ff6b00] hover:text-[#ff6b00] rounded-sm transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-[#ff6b00]" />
            <h2 className="text-white font-black text-xl tracking-wider"
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {isPractice ? 'PRACTICE' : 'BREACH — IRONGATE'}
            </h2>
          </div>
          <p className="text-[#5a6a7a] text-[10px] font-mono tracking-widest ml-2.5 mt-0.5">
            {isPractice ? 'SOLO TRAINING MODE' : 'DEMOLITION · FIRST TO 6 ROUNDS'}
          </p>
        </div>
        {/* Selected weapon badge */}
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 border border-[#ffffff15] bg-[#ffffff06] rounded-sm">
          <span style={{ color: selectedWeapon.color }} className="text-xs font-mono">{selectedWeapon.icon}</span>
          <span className="text-white text-xs font-mono tracking-widest">{selectedWeapon.label}</span>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
        <div className="w-full max-w-xl mx-auto flex flex-col gap-4">

          {/* CALLSIGN */}
          <div>
            <label className="text-[#ff6b00] text-[10px] tracking-[0.3em] font-mono font-bold mb-2 block">CALLSIGN</label>
            <input
              value={name}
              onChange={e => setName(e.target.value.toUpperCase().slice(0, 16))}
              className="w-full bg-[#ffffff0c] text-white font-mono text-base px-4 py-3 border border-[#ffffff18] focus:border-[#ff6b00] outline-none tracking-widest transition-colors"
              maxLength={16}
              spellCheck={false}
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            />
          </div>

          {/* FACTION / TEAM */}
          <div>
            <label className="text-[#ff6b00] text-[10px] tracking-[0.3em] font-mono font-bold mb-2 block flex items-center gap-2">
              <Users size={10} /> FACTION
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { t: 0 as const, label: 'ATTACKERS', sub: 'Plant the device', color: '#e84855', icon: <Flame size={16} /> },
                { t: 1 as const, label: 'DEFENDERS', sub: 'Stop the breach',  color: '#3a9bff', icon: <Zap size={16} /> },
              ]).map(({ t, label, sub, color, icon }) => (
                <button
                  key={t}
                  onClick={() => setTeam(t)}
                  className={`relative flex flex-col items-start gap-1 p-4 border transition-all overflow-hidden ${
                    team === t
                      ? 'border-transparent'
                      : 'border-[#ffffff18] bg-[#ffffff06] hover:border-[#ffffff30]'
                  }`}
                  style={team === t ? { border: `1px solid ${color}`, background: `${color}18` } : {}}
                >
                  {team === t && (
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />
                  )}
                  <div className="flex items-center gap-2" style={{ color: team === t ? color : '#8899aa' }}>
                    {icon}
                    <span className="font-black text-sm tracking-widest"
                      style={{ fontFamily: '"Space Grotesk", sans-serif', color: team === t ? color : '#8899aa' }}>
                      {label}
                    </span>
                  </div>
                  <span className="text-[#5a6a7a] text-[10px] font-mono tracking-widest">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* WEAPON */}
          <div>
            <label className="text-[#ff6b00] text-[10px] tracking-[0.3em] font-mono font-bold mb-2 block flex items-center gap-2">
              <Target size={10} /> PRIMARY WEAPON
            </label>
            <div className="flex flex-col gap-1">
              {WEAPONS.map(w => (
                <button
                  key={w.id}
                  onClick={() => setWeapon(w.id)}
                  className={`flex items-center gap-3 px-4 py-3 border transition-all text-left ${
                    weapon === w.id
                      ? 'bg-[#ffffff0e] border-transparent'
                      : 'border-[#ffffff10] bg-[#ffffff04] hover:bg-[#ffffff08] hover:border-[#ffffff20]'
                  }`}
                  style={weapon === w.id ? { borderLeft: `3px solid ${w.color}` } : { borderLeft: '3px solid transparent' }}
                >
                  <span className="w-8 text-center font-mono text-lg" style={{ color: w.color }}>{w.icon}</span>
                  <div className="flex-1">
                    <div className={`font-bold text-sm tracking-wider ${weapon === w.id ? 'text-white' : 'text-[#8899aa]'}`}
                      style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {w.label}
                    </div>
                    <div className="text-[#5a6a7a] text-[10px] font-mono">{w.sub}</div>
                  </div>
                  {weapon === w.id && (
                    <Crosshair size={14} style={{ color: w.color }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* BOTS */}
          <div>
            <label className="text-[#ff6b00] text-[10px] tracking-[0.3em] font-mono font-bold mb-2 block flex items-center gap-2">
              <Bot size={10} /> HOSTILES
            </label>
            <div className="flex items-center gap-2 mb-2">
              {[2, 4, 6, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setBotCount(n)}
                  className={`flex-1 py-2.5 text-sm font-black transition-all border ${
                    botCount === n
                      ? 'bg-[#ff6b00] border-[#ff6b00] text-black'
                      : 'border-[#ffffff18] text-[#5a6a7a] bg-[#ffffff06] hover:border-[#ff6b0060] hover:text-white'
                  }`}
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {([
                { d: 'easy' as const,   label: 'RECRUIT', color: '#44cc88' },
                { d: 'normal' as const, label: 'REGULAR',  color: '#ff6b00' },
                { d: 'hard' as const,   label: 'VETERAN',  color: '#e84855' },
              ]).map(({ d, label, color }) => (
                <button
                  key={d}
                  onClick={() => setDiff(d)}
                  className={`flex-1 py-2 text-[10px] font-mono tracking-widest uppercase border transition-all ${
                    difficulty === d ? 'text-black font-bold' : 'border-[#ffffff18] text-[#5a6a7a] bg-[#ffffff06] hover:border-[#ffffff30]'
                  }`}
                  style={difficulty === d ? { background: color, borderColor: color } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider info */}
          <div className="flex items-center gap-3 py-2 text-[#3a4050] text-[10px] font-mono">
            <div className="flex-1 h-px bg-[#ffffff0a]" />
            <span>IRONGATE · BREACH · 2 MIN ROUNDS</span>
            <div className="flex-1 h-px bg-[#ffffff0a]" />
          </div>

          {/* Deploy button */}
          <button
            onClick={() => onStart({ botCount, difficulty, playerName: name || 'OPERATOR', weapon, team })}
            className="relative w-full py-4 overflow-hidden group"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            <div className="absolute inset-0 bg-[#ff6b00]" />
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            <div className="absolute inset-y-0 right-0 w-12 flex items-center justify-center bg-[#00000020]">
              <Flame size={18} className="text-black" />
            </div>
            <span className="relative text-black font-black text-xl tracking-[0.15em]">DEPLOY</span>
          </button>

        </div>
      </div>
    </div>
  );
}
