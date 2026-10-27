// BREACHPOINT — Round result + Match result screens

import { MatchState } from '../game/modes';
import { PlayerEntity } from '../game/renderer';
import { Bot } from '../game/bots';

interface RoundResultProps {
  ms: MatchState;
  player: PlayerEntity;
  onContinue: () => void;
}

export function RoundResult({ ms, player, onContinue }: RoundResultProps) {
  const outcome = ms.roundOutcome;
  const isPlayerWin =
    (outcome === 'attackers_win' && player.team === 0) ||
    (outcome === 'defenders_win' && player.team === 1);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
      <div className="text-center">
        <p className="text-[#f59e0b] text-xs tracking-[0.3em] mb-2">ROUND {ms.roundNumber} RESULT</p>
        <p
          className={`text-5xl font-black tracking-tight mb-1 ${isPlayerWin ? 'text-[#4ade80]' : 'text-red-400'}`}
          style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}
        >
          {isPlayerWin ? 'ROUND WON' : 'ROUND LOST'}
        </p>
        <p className="text-[#9ca3af] text-sm mb-6">
          {outcome === 'attackers_win' ? 'ATTACKERS WIN THIS ROUND' : 'DEFENDERS WIN THIS ROUND'}
        </p>
        <div className="flex gap-8 justify-center mb-8">
          <div className="text-center">
            <p className="text-blue-400 text-lg font-black tabular-nums" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{ms.teamScore[0]}</p>
            <p className="text-[#6b7280] text-xs tracking-widest">ATK</p>
          </div>
          <div className="text-[#4b5563] self-center text-xl">—</div>
          <div className="text-center">
            <p className="text-red-400 text-lg font-black tabular-nums" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{ms.teamScore[1]}</p>
            <p className="text-[#6b7280] text-xs tracking-widest">DEF</p>
          </div>
        </div>
        <p className="text-[#4b5563] text-xs tracking-widest animate-pulse">NEXT ROUND STARTING…</p>
        <button onClick={onContinue} className="mt-4 px-8 py-2 bg-[#f59e0b] text-black text-xs font-black tracking-widest hover:bg-[#d97706] transition-colors">
          CONTINUE
        </button>
      </div>
    </div>
  );
}

interface MatchResultProps {
  ms: MatchState;
  player: PlayerEntity;
  bots: Bot[];
  onRematch: () => void;
  onMenu: () => void;
}

function commendation(player: PlayerEntity): string {
  const s = player.stats;
  if (s.defuses > 0) return 'BREACH DENIED';
  if (s.plants > 1) return 'BREACH OPENER';
  if (s.kills >= 5) return 'PRECISION OPERATOR';
  if (s.assists >= 3) return 'TEAM ANCHOR';
  if (s.kills > s.deaths) return 'SURVIVOR';
  return 'SOLDIER';
}

export function MatchResult({ ms, player, bots, onRematch, onMenu }: MatchResultProps) {
  const winner = ms.matchWinner;
  const isWin = winner === player.team;
  const s = player.stats;
  const kd = s.deaths === 0 ? s.kills.toFixed(1) : (s.kills / s.deaths).toFixed(2);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0c12] pointer-events-auto px-4 py-8 overflow-y-auto"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Result banner */}
      <div className="text-center mb-8">
        <p className="text-[#f59e0b] text-xs tracking-[0.3em] mb-2">MATCH COMPLETE</p>
        <p
          className={`text-6xl font-black tracking-tight ${isWin ? 'text-[#4ade80]' : 'text-red-400'}`}
          style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}
        >
          {isWin ? 'VICTORY' : 'DEFEAT'}
        </p>
        <p className="text-[#9ca3af] text-sm mt-1">IRONGATE · BREACH · PRACTICE</p>
      </div>

      {/* Score */}
      <div className="flex gap-6 items-center mb-8">
        <div className="text-center">
          <p className={`text-5xl font-black tabular-nums ${winner === 0 ? 'text-blue-400' : 'text-[#6b7280]'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {ms.teamScore[0]}
          </p>
          <p className="text-[#6b7280] text-xs tracking-widest mt-1">ATTACKERS</p>
        </div>
        <p className="text-[#4b5563] text-2xl">—</p>
        <div className="text-center">
          <p className={`text-5xl font-black tabular-nums ${winner === 1 ? 'text-red-400' : 'text-[#6b7280]'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {ms.teamScore[1]}
          </p>
          <p className="text-[#6b7280] text-xs tracking-widest mt-1">DEFENDERS</p>
        </div>
      </div>

      {/* Commendation */}
      <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/40 px-6 py-3 mb-8 text-center">
        <p className="text-[#f59e0b] text-xs tracking-[0.2em] mb-0.5">COMMENDATION</p>
        <p className="text-white font-bold tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {commendation(player)}
        </p>
      </div>

      {/* Stats grid */}
      <div className="w-full max-w-md bg-[#0f1117] border border-[#2a2e3a] p-4 mb-6">
        <p className="text-[#6b7280] text-xs tracking-widest mb-3">YOUR PERFORMANCE</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'KILLS', val: s.kills, color: 'text-white' },
            { label: 'DEATHS', val: s.deaths, color: 'text-red-300' },
            { label: 'K/D', val: kd, color: 'text-[#f59e0b]' },
            { label: 'PLANTS', val: s.plants, color: 'text-yellow-300' },
            { label: 'DEFUSES', val: s.defuses, color: 'text-green-400' },
            { label: 'ASSISTS', val: s.assists, color: 'text-blue-300' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-[#1a1e2a] px-2 py-2.5">
              <p className={`text-xl font-black tabular-nums ${color}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{val}</p>
              <p className="text-[#4b5563] text-xs tracking-widest mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Full scoreboard */}
      <div className="w-full max-w-md bg-[#0f1117] border border-[#2a2e3a] p-4 mb-8">
        <p className="text-[#6b7280] text-xs tracking-widest mb-3">FINAL SCOREBOARD</p>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(team => (
            <div key={team}>
              <p className={`text-xs font-bold tracking-widest mb-2 ${team === 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {team === 0 ? 'ATTACKERS' : 'DEFENDERS'}
              </p>
              <div className="space-y-1 text-xs">
                {player.team === team && (
                  <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-2 py-1.5 flex justify-between">
                    <span className="text-[#f59e0b] font-bold">YOU</span>
                    <span className="tabular-nums text-white">{s.kills}/{s.deaths}</span>
                  </div>
                )}
                {bots.filter(b => b.team === team).map(b => {
                  const bs = ms.stats[b.id];
                  return (
                    <div key={b.id} className="bg-[#1a1e2a] px-2 py-1.5 flex justify-between">
                      <span className="text-[#6b7280]">BOT</span>
                      <span className="tabular-nums text-[#9ca3af]">{bs?.kills ?? 0}/{bs?.deaths ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-md">
        <button
          onClick={onRematch}
          className="flex-1 py-4 bg-[#f59e0b] hover:bg-[#d97706] text-black text-sm font-black tracking-[0.15em] transition-colors"
        >
          REMATCH
        </button>
        <button
          onClick={onMenu}
          className="flex-1 py-4 bg-[#1a1e2a] hover:bg-[#222636] border border-[#2a2e3a] hover:border-[#f59e0b]/40 text-white text-sm font-bold tracking-[0.1em] transition-all"
        >
          MENU
        </button>
      </div>
    </div>
  );
}
