import { useEffect, useRef, useState } from 'react';
import type { GameSnapshot } from '../game/renderer';

interface Props {
  snap: GameSnapshot;
  showScoreboard: boolean;
}

function formatTime(secs: number): string {
  const s = Math.max(0, secs);
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function AmmoBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? current / max : 0;
  const low = pct <= 0.25;
  const mid = pct <= 0.5;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: Math.min(max, 30) }).map((_, i) => (
        <div key={i} className="h-3 w-1 rounded-full transition-all"
          style={{ background: i < current ? (low ? '#e84855' : mid ? '#ff6b00' : '#ffffff') : '#ffffff18' }} />
      ))}
    </div>
  );
}

export function HUD({ snap, showScoreboard }: Props) {
  const { player, matchState: ms, crosshairHit, interactProgress, nearObjectiveSite } = snap;
  const weapon = player.weapon;
  const phase = ms.phase;

  // Kill flash
  const [killFlash, setKillFlash] = useState(false);
  const killsRef = useRef(player.stats.kills);
  useEffect(() => {
    if (player.stats.kills > killsRef.current) {
      killsRef.current = player.stats.kills;
      setKillFlash(true);
      setTimeout(() => setKillFlash(false), 600);
    }
  }, [player.stats.kills]);

  // Damage flash
  const [dmgFlash, setDmgFlash] = useState(false);
  const hpRef = useRef(player.health);
  useEffect(() => {
    if (player.health < hpRef.current) {
      hpRef.current = player.health;
      setDmgFlash(true);
      setTimeout(() => setDmgFlash(false), 400);
    } else {
      hpRef.current = player.health;
    }
  }, [player.health]);

  const timerUrgent = ms.phaseTimer < 30;
  const timerWarn   = ms.phaseTimer < 60;
  const teamColor   = player.team === 0 ? '#e84855' : '#3a9bff';
  const teamLabel   = player.team === 0 ? 'ATK' : 'DEF';

  const activeObj = ms.objectives.find(o =>
    o.phase !== 'idle' && o.phase !== 'defused' && o.phase !== 'detonated'
  ) ?? ms.objectives[0];

  return (
    <div className="absolute inset-0 pointer-events-none select-none"
      style={{ fontFamily: '"DM Sans", sans-serif' }}>

      {/* Damage vignette */}
      {dmgFlash && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 120px rgba(232,72,85,0.7)', animation: 'none' }} />
      )}
      {/* Always-on subtle vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5)' }} />

      {/* Kill confirm flash */}
      {killFlash && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-24 pointer-events-none">
          <div className="text-[#ff6b00] font-black text-xs tracking-[0.4em] text-center"
            style={{ fontFamily: '"Space Grotesk", sans-serif', textShadow: '0 0 20px #ff6b00' }}>
            ELIMINATED
          </div>
        </div>
      )}

      {/* ── TOP CENTER: score + timer ── */}
      {(phase === 'active' || phase === 'warmup') && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
          {/* Score bar */}
          <div className="flex items-stretch"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.6))' }}>
            {/* Attacker score */}
            <div className="flex items-center gap-2 px-6 py-2 border-r border-[#ffffff15]">
              <div className="w-2 h-2 rounded-full bg-[#e84855]" />
              <span className="text-white font-black text-2xl tabular-nums"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{ms.teamScore[0]}</span>
              <span className="text-[#e84855] text-[10px] font-mono tracking-widest">ATK</span>
            </div>
            {/* Timer */}
            <div className="flex flex-col items-center justify-center px-6 py-1 border-r border-[#ffffff15]">
              <span className="font-black text-2xl tabular-nums transition-colors"
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  color: timerUrgent ? '#e84855' : timerWarn ? '#ff6b00' : '#ffffff',
                  textShadow: timerUrgent ? '0 0 20px rgba(232,72,85,0.8)' : 'none',
                }}>
                {formatTime(ms.phaseTimer)}
              </span>
              <span className="text-[#5a6a7a] text-[9px] font-mono tracking-widest">ROUND {ms.roundNumber}</span>
            </div>
            {/* Defender score */}
            <div className="flex items-center gap-2 px-6 py-2">
              <span className="text-[#3a9bff] text-[10px] font-mono tracking-widest">DEF</span>
              <span className="text-white font-black text-2xl tabular-nums"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{ms.teamScore[1]}</span>
              <div className="w-2 h-2 rounded-full bg-[#3a9bff]" />
            </div>
          </div>
          {/* Objective bar */}
          {activeObj && activeObj.phase !== 'idle' && phase === 'active' && (
            <div className={`mt-0.5 px-6 py-1 text-[10px] font-mono tracking-widest border-t-2 ${
              activeObj.phase === 'armed' || activeObj.phase === 'planting'
                ? 'border-[#e84855] bg-[#e8485530] text-[#e84855]'
                : 'border-[#44cc88] bg-[#44cc8830] text-[#44cc88]'
            }`}
              style={{ background: activeObj.phase === 'armed' || activeObj.phase === 'planting'
                ? 'rgba(232,72,85,0.25)' : 'rgba(68,204,136,0.25)' }}>
              {activeObj.phase === 'planting'  && `▶ PLANTING ${Math.round(activeObj.progress * 100)}%`}
              {activeObj.phase === 'armed'     && `⚠ ARMED — ${formatTime(activeObj.armedTimer)}`}
              {activeObj.phase === 'defusing'  && `⟳ DEFUSING ${Math.round(Math.abs(activeObj.progress) * 100)}%`}
            </div>
          )}
        </div>
      )}

      {/* ── CROSSHAIR ── */}
      {player.alive && phase === 'active' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"
            style={{ filter: crosshairHit ? 'drop-shadow(0 0 6px #ff6b00)' : 'none' }}>
            {/* Four lines */}
            <line x1="16" y1="2"  x2="16" y2="10" stroke={crosshairHit ? '#ff6b00' : 'rgba(255,255,255,0.9)'} strokeWidth="2" />
            <line x1="16" y1="22" x2="16" y2="30" stroke={crosshairHit ? '#ff6b00' : 'rgba(255,255,255,0.9)'} strokeWidth="2" />
            <line x1="2"  y1="16" x2="10" y2="16" stroke={crosshairHit ? '#ff6b00' : 'rgba(255,255,255,0.9)'} strokeWidth="2" />
            <line x1="22" y1="16" x2="30" y2="16" stroke={crosshairHit ? '#ff6b00' : 'rgba(255,255,255,0.9)'} strokeWidth="2" />
            {/* Center dot */}
            <circle cx="16" cy="16" r="2" fill={crosshairHit ? '#ff6b00' : 'rgba(255,255,255,0.8)'} />
          </svg>
        </div>
      )}

      {/* ── INTERACT PROMPT ── */}
      {nearObjectiveSite && player.alive && phase === 'active' && (
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="border border-[#ff6b00] text-[#ff6b00] text-xs font-mono px-2 py-0.5 font-bold">E</span>
            <span className="text-white text-xs font-mono tracking-widest">
              {player.team === 0
                ? (activeObj?.phase === 'armed' ? 'HOLD · DEFUSE' : 'HOLD · PLANT DEVICE')
                : 'HOLD · DEFUSE DEVICE'}
            </span>
          </div>
          {interactProgress > 0 && (
            <div className="w-32 h-1 bg-[#ffffff18] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#ff6b00]"
                style={{ width: `${interactProgress * 100}%`, transition: 'width 0.1s linear' }} />
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM LEFT: health ── */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)', height: '160px' }} />

      <div className="absolute bottom-6 left-6 flex flex-col gap-2">
        {/* Team badge */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4" style={{ background: teamColor }} />
          <span className="text-[10px] font-mono tracking-[0.3em]" style={{ color: teamColor }}>{teamLabel}</span>
          <span className="text-[#5a6a7a] text-[10px] font-mono">·</span>
          <span className="text-[#8899aa] text-[10px] font-mono tracking-widest">OPERATOR</span>
        </div>

        {/* HP bar */}
        <div className="flex items-center gap-3">
          <div className="w-28 h-2.5 bg-[#ffffff15] rounded-full overflow-hidden relative">
            <div className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${player.health}%`,
                background: player.health > 60
                  ? 'linear-gradient(to right, #22cc66, #44ee88)'
                  : player.health > 25
                    ? 'linear-gradient(to right, #cc8800, #ff6b00)'
                    : 'linear-gradient(to right, #cc2233, #e84855)',
                boxShadow: player.health < 30 ? '0 0 8px rgba(232,72,85,0.5)' : 'none',
              }} />
          </div>
          <span className="text-white font-black text-lg tabular-nums"
            style={{ fontFamily: '"Space Grotesk", sans-serif', color: player.health < 30 ? '#e84855' : 'white' }}>
            {Math.ceil(player.health)}
          </span>
        </div>
        <div className="text-[#5a6a7a] text-[9px] font-mono tracking-widest">HEALTH</div>
      </div>

      {/* ── BOTTOM RIGHT: weapon / ammo ── */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-1">
        <div className="text-[#8899aa] text-[10px] font-mono tracking-widest mb-1">
          {weapon.def.name.toUpperCase()}
        </div>
        {/* Ammo count */}
        <div className="flex items-end gap-1">
          <span className={`font-black tabular-nums transition-colors ${
            weapon.ammoInMag === 0 ? 'text-[#e84855]' : weapon.ammoInMag <= 5 ? 'text-[#ff6b00]' : 'text-white'
          }`}
            style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '2.2rem', lineHeight: 1 }}>
            {weapon.ammoInMag}
          </span>
          <span className="text-[#5a6a7a] font-mono text-lg mb-1 tabular-nums">
            /{weapon.reserveAmmo}
          </span>
        </div>
        {/* Visual pip bar */}
        <AmmoBar current={weapon.ammoInMag} max={weapon.def.magazineSize} />
        {weapon.reloading && (
          <div className="text-[#ff6b00] text-[10px] font-mono tracking-widest mt-1 animate-pulse">
            ◎ RELOADING
          </div>
        )}
      </div>

      {/* ── PHASE BANNERS ── */}
      {phase === 'warmup' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[#ff6b00] font-black tracking-widest mb-2"
              style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '3.5rem', letterSpacing: '-0.02em',
                textShadow: '0 0 40px rgba(255,107,0,0.5)' }}>
              DEPLOYING
            </div>
            <div className="text-[#8899aa] text-sm font-mono tracking-[0.3em]">ROUND {ms.roundNumber}</div>
          </div>
        </div>
      )}

      {!player.alive && phase === 'active' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Red overlay */}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div className="relative text-center">
            <div className="text-[#e84855] font-black text-4xl tracking-widest mb-2"
              style={{ fontFamily: '"Space Grotesk", sans-serif', textShadow: '0 0 30px rgba(232,72,85,0.6)' }}>
              ELIMINATED
            </div>
            <div className="text-[#8899aa] text-sm font-mono tracking-widest">Waiting for next round…</div>
          </div>
        </div>
      )}

      {phase === 'round_end' && ms.roundOutcome && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
          <div className="relative text-center">
            <div className="text-white font-black text-4xl tracking-tight mb-1"
              style={{ fontFamily: '"Space Grotesk", sans-serif',
                textShadow: ms.roundOutcome === 'attackers_win'
                  ? '0 0 40px rgba(232,72,85,0.7)'
                  : '0 0 40px rgba(58,155,255,0.7)' }}>
              {ms.roundOutcome === 'attackers_win' ? 'ATTACKERS WIN' : 'DEFENDERS WIN'}
            </div>
            <div className="text-[#8899aa] text-sm font-mono tracking-widest">
              {ms.teamScore[0]} — {ms.teamScore[1]}
            </div>
          </div>
        </div>
      )}

      {/* ── SCOREBOARD (Tab) ── */}
      {showScoreboard && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.82)' }}>
          <div className="w-full max-w-2xl mx-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4 px-2">
              <div className="w-1 h-6 bg-[#ff6b00]" />
              <span className="text-white font-black text-lg tracking-wider"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                BREACH — IRONGATE
              </span>
              <span className="ml-auto text-[#5a6a7a] text-xs font-mono tracking-widest">
                ROUND {ms.roundNumber} · {formatTime(ms.phaseTimer)}
              </span>
            </div>

            {([0, 1] as const).map(team => {
              const entries = [
                ...(team === player.team
                  ? [{ id: 'player', name: 'YOU', stats: player.stats, alive: player.alive }]
                  : []),
                ...snap.bots.filter(b => b.team === team).map(b => ({
                  id: b.id, name: b.id,
                  stats: { kills: 0, deaths: 0, assists: 0, plants: 0, defuses: 0, objectiveTime: 0, roundsWon: 0 },
                  alive: b.alive,
                })),
              ];
              const tc = team === 0 ? '#e84855' : '#3a9bff';
              const tl = team === 0 ? 'ATTACKERS' : 'DEFENDERS';
              return (
                <div key={team} className="mb-3">
                  <div className="flex items-center gap-2 px-4 py-2 mb-1"
                    style={{ background: `${tc}18`, borderLeft: `3px solid ${tc}` }}>
                    <span className="font-black text-xs tracking-[0.3em]" style={{ color: tc, fontFamily: '"Space Grotesk", sans-serif' }}>
                      {tl}
                    </span>
                    <span className="font-black text-lg ml-auto" style={{ color: tc }}>{ms.teamScore[team]}</span>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {['PLAYER','K','D','A','OBJ'].map(h => (
                          <th key={h} className="py-1.5 px-3 font-mono tracking-wider text-[#5a6a7a] text-center first:text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(p => (
                        <tr key={p.id}
                          className="border-t border-[#ffffff08]"
                          style={p.id === 'player' ? { background: 'rgba(255,107,0,0.06)' } : {}}>
                          <td className="py-2 px-3">
                            <span className={`font-mono font-bold ${p.id === 'player' ? '' : 'text-[#aabbcc]'}`}
                              style={p.id === 'player' ? { color: '#ff6b00' } : {}}>
                              {p.id === 'player' ? '▶ ' : ''}{p.name}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums text-white font-bold">{p.stats.kills}</td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums text-[#8899aa]">{p.stats.deaths}</td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums text-[#5a6a7a]">{p.stats.assists}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                              p.alive
                                ? 'bg-[#44cc8820] text-[#44cc88]'
                                : 'bg-[#e8485520] text-[#e84855]'
                            }`}>
                              {p.alive ? '●' : '○'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="text-center text-[#3a4050] text-[10px] font-mono tracking-widest mt-3">
              RELEASE TAB TO CLOSE
            </div>
          </div>
        </div>
      )}

      {/* ── KILL FEED (top right) ── */}
      <div className="absolute right-4" style={{ top: '80px' }}>
        {ms.killfeed.slice(-5).reverse().map((k, i) => (
          <div key={k.id}
            className="flex items-center gap-1.5 mb-1 px-2 py-1 text-[11px] font-mono"
            style={{ background: 'rgba(0,0,0,0.55)', opacity: 1 - i * 0.18 }}>
            <span className="text-[#e84855] font-bold">{k.attackerName}</span>
            <span className="text-[#3a4050]">✕</span>
            <span className="text-[#8899aa]">{k.victimName}</span>
          </div>
        ))}
      </div>

      {/* ── MAP LABEL ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <span className="text-[#2a3040] text-[9px] font-mono tracking-[0.4em]">IRONGATE · BREACH</span>
      </div>
    </div>
  );
}
