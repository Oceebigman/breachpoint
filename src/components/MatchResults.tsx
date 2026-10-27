import { Trophy, RotateCcw, Home, Flame, Crosshair, Shield } from 'lucide-react';
import type { GameSnapshot } from '../game/renderer';

interface Props {
  snap: GameSnapshot;
  onRematch: () => void;
  onMenu: () => void;
}

// Victory / defeat splash images from Unsplash
const WIN_IMG  = 'https://images.unsplash.com/photo-1547095399-18c5f2a32dcd?w=1400&q=70&fit=crop'; // dramatic explosion
const LOSE_IMG = 'https://images.unsplash.com/photo-1612198790700-adding7d4d3e1?w=1400&q=70&fit=crop'; // ruins / smoke
const DRAW_IMG = 'https://images.unsplash.com/photo-1503676382389-4809596d5290?w=1400&q=70&fit=crop'; // fog

export function MatchResults({ snap, onRematch, onMenu }: Props) {
  const { player, matchState: ms, bots } = snap;
  const winner = ms.matchWinner;
  const playerWon = winner === player.team;
  const isDraw = winner === null;

  const bgImg  = isDraw ? DRAW_IMG : playerWon ? WIN_IMG : LOSE_IMG;
  const accent = isDraw ? '#ff6b00' : playerWon ? '#44ee88' : '#e84855';
  const label  = isDraw ? 'DRAW' : playerWon ? 'VICTORY' : 'DEFEAT';

  const commendations: { text: string; icon: JSX.Element }[] = [];
  if (player.stats.kills >= 5)    commendations.push({ text: 'PRECISION KILLER', icon: <Crosshair size={10} /> });
  if (player.stats.plants >= 1)   commendations.push({ text: 'OBJECTIVE SPECIALIST', icon: <Flame size={10} /> });
  if (player.stats.defuses >= 1)  commendations.push({ text: 'LAST DEFENDER', icon: <Shield size={10} /> });
  if (player.stats.deaths === 0)  commendations.push({ text: 'FLAWLESS', icon: <Trophy size={10} /> });
  if (player.stats.assists >= 3)  commendations.push({ text: 'TEAM ANCHOR', icon: <Shield size={10} /> });

  const allRows = [
    { id: 'player', name: 'YOU', stats: player.stats, team: player.team },
    ...bots.map(b => ({
      id: b.id, name: b.id,
      stats: b.id in ms.stats ? ms.stats[b.id] : { kills: 0, deaths: 0, assists: 0, plants: 0, defuses: 0, objectiveTime: 0, roundsWon: 0 },
      team: b.team,
    })),
  ].sort((a, b) => (b.stats.kills * 2 + b.stats.plants * 3) - (a.stats.kills * 2 + a.stats.plants * 3));

  const mvp = allRows[0];

  return (
    <div className="min-h-dvh bg-black flex flex-col relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0">
        <img src={bgImg} alt=""
          className="w-full h-full object-cover"
          style={{ filter: `brightness(0.3) saturate(1.5)${!playerWon && !isDraw ? ' hue-rotate(300deg)' : ''}` }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.97) 100%)' }} />
        {/* Accent color overlay tint */}
        <div className="absolute inset-0 opacity-10"
          style={{ background: `radial-gradient(ellipse at 50% 20%, ${accent}, transparent 70%)` }} />
      </div>

      {/* Top accent line */}
      <div className="relative z-10 h-1 w-full" style={{ background: accent }} />

      <div className="relative z-10 flex-1 overflow-y-auto flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-xl">

          {/* Result hero */}
          <div className="text-center mb-8">
            <div className="text-[#8899aa] text-[10px] font-mono tracking-[0.35em] mb-3">
              MATCH COMPLETE · IRONGATE · BREACH
            </div>
            <div className="font-black leading-none mb-2"
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: 'clamp(4rem, 12vw, 7rem)',
                color: accent,
                letterSpacing: '-0.04em',
                textShadow: `0 0 80px ${accent}60, 0 4px 30px rgba(0,0,0,0.8)`,
              }}>
              {label}
            </div>
            {/* Score */}
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex flex-col items-center">
                <span className="font-black text-3xl text-[#e84855] tabular-nums"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{ms.teamScore[0]}</span>
                <span className="text-[#5a6a7a] text-[10px] font-mono tracking-widest">ATK</span>
              </div>
              <span className="text-[#3a4050] font-mono text-xl">—</span>
              <div className="flex flex-col items-center">
                <span className="font-black text-3xl text-[#3a9bff] tabular-nums"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{ms.teamScore[1]}</span>
                <span className="text-[#5a6a7a] text-[10px] font-mono tracking-widest">DEF</span>
              </div>
            </div>
          </div>

          {/* MVP */}
          {mvp && (
            <div className="flex items-center gap-3 px-4 py-3 mb-4 border-l-4"
              style={{
                borderColor: '#ffd700',
                background: 'rgba(255,215,0,0.06)',
                borderRight: '1px solid rgba(255,215,0,0.15)',
              }}>
              <Trophy size={20} style={{ color: '#ffd700', flexShrink: 0 }} />
              <div className="flex-1">
                <div className="text-[#ffd700] text-[10px] font-mono tracking-widest mb-0.5">MATCH MVP</div>
                <div className="text-white font-bold" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  {mvp.name}
                </div>
              </div>
              <div className="text-right text-xs font-mono text-[#8899aa] tabular-nums">
                <div className="text-white font-bold">{mvp.stats.kills}K</div>
                <div>{mvp.stats.deaths}D · {mvp.stats.plants}P</div>
              </div>
            </div>
          )}

          {/* Player stats */}
          <div className="mb-4 border border-[#ffffff10] bg-[#ffffff05]">
            <div className="px-4 py-2 border-b border-[#ffffff08] flex items-center gap-2">
              <div className="w-0.5 h-3" style={{ background: accent }} />
              <span className="text-[#8899aa] text-[10px] font-mono tracking-widest">YOUR PERFORMANCE</span>
            </div>
            <div className="grid grid-cols-5 gap-0 divide-x divide-[#ffffff08]">
              {([
                { label: 'KILLS',   value: player.stats.kills,   color: '#ffffff' },
                { label: 'DEATHS',  value: player.stats.deaths,  color: '#e84855' },
                { label: 'ASSISTS', value: player.stats.assists, color: '#8899aa' },
                { label: 'PLANTS',  value: player.stats.plants,  color: '#ff6b00' },
                { label: 'DEFUSES', value: player.stats.defuses, color: '#3a9bff' },
              ]).map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center py-4">
                  <span className="font-black text-2xl tabular-nums"
                    style={{ fontFamily: '"Space Grotesk", sans-serif', color }}>{value}</span>
                  <span className="text-[#4a5a6a] text-[9px] font-mono tracking-widest mt-1">{label}</span>
                </div>
              ))}
            </div>

            {commendations.length > 0 && (
              <div className="px-4 py-3 border-t border-[#ffffff08]">
                <div className="flex flex-wrap gap-2">
                  {commendations.map(c => (
                    <span key={c.text}
                      className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider px-2.5 py-1 border"
                      style={{ borderColor: `${accent}44`, color: accent, background: `${accent}10` }}>
                      {c.icon} {c.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Full scoreboard */}
          <div className="mb-6 border border-[#ffffff10] overflow-hidden">
            <div className="px-4 py-2 border-b border-[#ffffff08] text-[#5a6a7a] text-[10px] font-mono tracking-widest"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              FINAL SCOREBOARD
            </div>
            <table className="w-full text-xs">
              <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                <tr>
                  {['PLAYER', 'TEAM', 'K', 'D', 'A', 'OBJ'].map(h => (
                    <th key={h}
                      className="py-2 px-3 font-mono tracking-wider text-[#4a5a6a] text-center first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.map((p, i) => (
                  <tr key={p.id} className="border-t border-[#ffffff06]"
                    style={{
                      background: p.id === 'player' ? `${accent}08` : i === 0 ? 'rgba(255,215,0,0.04)' : 'transparent',
                    }}>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[9px]" style={{ color: '#ffd700' }}>MVP</span>}
                        <span className="font-mono font-bold"
                          style={{ color: p.id === 'player' ? accent : '#aabbcc' }}>
                          {p.id === 'player' ? `▶ ${p.name}` : p.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="w-2 h-2 rounded-full mx-auto"
                        style={{ background: p.team === 0 ? '#e84855' : '#3a9bff' }} />
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-white font-bold">{p.stats.kills}</td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-[#8899aa]">{p.stats.deaths}</td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-[#5a6a7a]">{p.stats.assists}</td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums" style={{ color: '#ff6b00' }}>
                      {p.stats.plants + p.stats.defuses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3">
            <button
              onClick={onRematch}
              className="flex-1 flex items-center justify-center gap-2 py-4 font-black text-base tracking-wide transition-opacity hover:opacity-90"
              style={{
                background: accent,
                color: isDraw ? '#000' : playerWon ? '#000' : '#fff',
                fontFamily: '"Space Grotesk", sans-serif',
              }}
            >
              <RotateCcw size={16} /> REMATCH
            </button>
            <button
              onClick={onMenu}
              className="flex items-center justify-center gap-2 px-6 py-4 border border-[#ffffff20] text-[#8899aa] hover:border-[#ffffff40] hover:text-white transition-all font-mono text-sm"
            >
              <Home size={14} /> MENU
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
