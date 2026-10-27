// BREACHPOINT — BREACH mode: round rules, objective FSM, scoring, win/loss

import { bus } from './core';

export type ObjectivePhase =
  | 'idle'       // nothing happening at site
  | 'planting'   // attacker is interacting
  | 'armed'      // planted — countdown to detonation
  | 'defusing'   // defender is interacting to disable
  | 'detonated'  // attackers win via detonation
  | 'defused';   // defenders win via defuse

export type RoundOutcome = 'attackers_win' | 'defenders_win' | null;

export interface ObjectiveState {
  siteId: string;
  phase: ObjectivePhase;
  progress: number;       // 0–1 for planting/defusing interaction
  armedTimer: number;     // seconds remaining before detonation (when armed)
  interactingId: string | null;
}

export interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  plants: number;
  defuses: number;
  objectiveTime: number;  // seconds near objective
  roundsWon: number;
}

export function emptyStats(): PlayerStats {
  return { kills: 0, deaths: 0, assists: 0, plants: 0, defuses: 0, objectiveTime: 0, roundsWon: 0 };
}

export interface MatchConfig {
  maxRounds: number;         // default 12 (first to 7 wins)
  roundDuration: number;     // seconds active phase
  plantDuration: number;     // seconds to plant
  defuseDuration: number;    // seconds to defuse
  armedDuration: number;     // seconds until detonation
  warmupDuration: number;    // seconds
  teamSize: number;
}

export const DEFAULT_CONFIG: MatchConfig = {
  maxRounds: 12,
  roundDuration: 90,
  plantDuration: 3,
  defuseDuration: 5,
  armedDuration: 40,
  warmupDuration: 5,
  teamSize: 5,
};

export type MatchPhase = 'warmup' | 'active' | 'round_end' | 'match_end';

export interface MatchState {
  phase: MatchPhase;
  phaseTimer: number;       // seconds remaining in current phase
  roundNumber: number;
  teamScore: [number, number]; // [attackers_wins, defenders_wins]
  objectives: ObjectiveState[];
  roundOutcome: RoundOutcome;
  matchWinner: 0 | 1 | null;
  aliveCount: [number, number]; // [team0, team1]
  config: MatchConfig;
  stats: Record<string, PlayerStats>;
  killfeed: KillfeedEntry[];
  roundEndDelay: number;    // seconds before next round starts
}

export interface KillfeedEntry {
  id: string;
  attackerId: string;
  attackerName: string;
  victimId: string;
  victimName: string;
  weaponName: string;
  timestamp: number;
}

export function createMatchState(config: MatchConfig, siteIds: string[]): MatchState {
  return {
    phase: 'warmup',
    phaseTimer: config.warmupDuration,
    roundNumber: 1,
    teamScore: [0, 0],
    objectives: siteIds.map(id => ({
      siteId: id,
      phase: 'idle',
      progress: 0,
      armedTimer: config.armedDuration,
      interactingId: null,
    })),
    roundOutcome: null,
    matchWinner: null,
    aliveCount: [0, 0],
    config,
    stats: {},
    killfeed: [],
    roundEndDelay: 3,
  };
}

export function ensureStats(ms: MatchState, id: string): MatchState {
  if (ms.stats[id]) return ms;
  return { ...ms, stats: { ...ms.stats, [id]: emptyStats() } };
}

/** Per-frame tick — returns updated state + events */
export interface ModeTickInput {
  ms: MatchState;
  dt: number;
  aliveCount: [number, number];
}

export interface ModeEvent {
  type: 'round_start' | 'round_end' | 'match_end' | 'objective_armed' | 'objective_defused' | 'objective_detonated' | 'warmup_end';
  payload?: unknown;
}

export interface ModeTickResult {
  ms: MatchState;
  events: ModeEvent[];
}

export function tickMode(input: ModeTickInput): ModeTickResult {
  let ms: MatchState = { ...input.ms, aliveCount: input.aliveCount };
  const events: ModeEvent[] = [];
  const dt = input.dt;

  ms = { ...ms, phaseTimer: ms.phaseTimer - dt };

  if (ms.phase === 'warmup') {
    if (ms.phaseTimer <= 0) {
      ms = startRound(ms);
      events.push({ type: 'warmup_end' });
      events.push({ type: 'round_start', payload: ms.roundNumber });
    }
    return { ms, events };
  }

  if (ms.phase === 'active') {
    // Tick all objectives
    ms = { ...ms, objectives: ms.objectives.map(obj => tickObjective(obj, ms.config, dt, events)) };

    // Check win conditions
    const outcome = checkRoundOutcome(ms);
    if (outcome) {
      ms = resolveRound(ms, outcome, events);
    }
    return { ms, events };
  }

  if (ms.phase === 'round_end') {
    if (ms.phaseTimer <= 0) {
      if (ms.matchWinner !== null) {
        ms = { ...ms, phase: 'match_end', phaseTimer: 10 };
        events.push({ type: 'match_end', payload: ms.matchWinner });
      } else {
        ms = startRound({ ...ms, roundNumber: ms.roundNumber + 1 });
        events.push({ type: 'round_start', payload: ms.roundNumber });
      }
    }
    return { ms, events };
  }

  return { ms, events };
}

/** Attackers interact (E-hold) with a site — returns updated MatchState */
export function playerInteractObjective(
  ms: MatchState,
  siteId: string,
  playerId: string,
  playerTeam: 0 | 1,
  isHolding: boolean,
  dt: number,
): MatchState {
  if (ms.phase !== 'active') return ms;

  const objIdx = ms.objectives.findIndex(o => o.siteId === siteId);
  if (objIdx === -1) return ms;
  const obj = ms.objectives[objIdx];

  let updated = { ...obj };

  if (playerTeam === 0 && (obj.phase === 'idle' || obj.phase === 'planting')) {
    // Attacker planting
    if (isHolding) {
      updated.phase = 'planting';
      updated.interactingId = playerId;
      updated.progress = Math.min(1, obj.progress + dt / ms.config.plantDuration);
      if (updated.progress >= 1) {
        updated.phase = 'armed';
        updated.armedTimer = ms.config.armedDuration;
        updated.progress = 1;
        const s = ensureStats(ms, playerId);
        const stats = { ...s.stats[playerId], plants: s.stats[playerId].plants + 1 };
        ms = { ...s, stats: { ...s.stats, [playerId]: stats } };
        bus.emit('objective_armed', { siteId, playerId });
      }
    } else {
      // Stopped holding
      updated.phase = 'idle';
      updated.progress = Math.max(0, obj.progress - dt * 0.5); // slow decay
      updated.interactingId = null;
    }
  } else if (playerTeam === 1 && obj.phase === 'armed') {
    // Defender defusing
    if (isHolding) {
      updated.phase = 'defusing';
      updated.interactingId = playerId;
      updated.progress = Math.min(1, obj.progress - dt / ms.config.defuseDuration);
      // We repurpose progress: 1 = fully armed, 0 = defused
      // Actually: use a separate defuseProgress
    } else {
      updated.phase = 'armed';
      updated.interactingId = null;
    }
  }

  const newObjs = ms.objectives.map((o, i) => i === objIdx ? updated : o);
  return { ...ms, objectives: newObjs };
}

// Simplified defuse: separate field approach
export function playerDefuse(
  ms: MatchState,
  siteId: string,
  playerId: string,
  isHolding: boolean,
  dt: number,
): MatchState {
  if (ms.phase !== 'active') return ms;
  const objIdx = ms.objectives.findIndex(o => o.siteId === siteId);
  if (objIdx === -1) return ms;
  const obj = ms.objectives[objIdx];
  if (obj.phase !== 'armed' && obj.phase !== 'defusing') return ms;

  let updated = { ...obj };
  if (isHolding) {
    updated.phase = 'defusing';
    updated.interactingId = playerId;
    // Repurpose armedTimer as defuse progress (counts down separately)
    // We use a dedicated defuseProgress in the object's progress field when defusing
    // Store defuse progress separately: use negative progress
    updated.progress = Math.max(-1, obj.progress - dt / ms.config.defuseDuration);
    if (updated.progress <= -1) {
      updated.phase = 'defused';
      const s = ensureStats(ms, playerId);
      const stats = { ...s.stats[playerId], defuses: s.stats[playerId].defuses + 1 };
      ms = { ...s, stats: { ...s.stats, [playerId]: stats } };
      bus.emit('objective_defused', { siteId, playerId });
    }
  } else {
    updated.phase = 'armed';
    updated.progress = Math.min(1, obj.progress + dt * 0.3); // partial decay back
    updated.interactingId = null;
  }

  return { ...ms, objectives: ms.objectives.map((o, i) => i === objIdx ? updated : o) };
}

export function recordKill(
  ms: MatchState,
  attackerId: string,
  attackerName: string,
  victimId: string,
  victimName: string,
  weaponName: string,
): MatchState {
  let s = ensureStats(ms, attackerId);
  s = ensureStats(s, victimId);
  const aStats = { ...s.stats[attackerId], kills: s.stats[attackerId].kills + 1 };
  const vStats = { ...s.stats[victimId], deaths: s.stats[victimId].deaths + 1 };
  const entry: KillfeedEntry = {
    id: Math.random().toString(36).slice(2),
    attackerId, attackerName, victimId, victimName, weaponName,
    timestamp: Date.now(),
  };
  const feed = [entry, ...s.killfeed].slice(0, 5);
  return {
    ...s,
    stats: { ...s.stats, [attackerId]: aStats, [victimId]: vStats },
    killfeed: feed,
  };
}

// --- Internal helpers ---

function tickObjective(obj: ObjectiveState, config: MatchConfig, dt: number, events: ModeEvent[]): ObjectiveState {
  if (obj.phase === 'armed' || obj.phase === 'defusing') {
    const next = { ...obj, armedTimer: obj.armedTimer - dt };
    if (next.armedTimer <= 0) {
      events.push({ type: 'objective_detonated', payload: obj.siteId });
      return { ...next, phase: 'detonated', armedTimer: 0 };
    }
    return next;
  }
  if (obj.phase === 'planting' && obj.interactingId === null) {
    // Interrupted
    return { ...obj, phase: 'idle', progress: Math.max(0, obj.progress - dt * 0.5) };
  }
  return obj;
}

function checkRoundOutcome(ms: MatchState): RoundOutcome {
  // Detonated = attackers win
  const detonated = ms.objectives.some(o => o.phase === 'detonated');
  if (detonated) return 'attackers_win';

  // Defused (all active objectives defused) = defenders win
  const anyArmed = ms.objectives.some(o => o.phase === 'armed' || o.phase === 'defusing' || o.phase === 'planting');
  const anyDetonated = ms.objectives.some(o => o.phase === 'detonated');
  if (!anyArmed && !anyDetonated && ms.objectives.some(o => o.phase === 'defused')) {
    return 'defenders_win';
  }

  // All attackers dead = defenders win
  if (ms.aliveCount[0] <= 0 && ms.aliveCount[1] > 0) return 'defenders_win';
  // All defenders dead = attackers win (if no bomb site planted yet, they still win by elim)
  if (ms.aliveCount[1] <= 0 && ms.aliveCount[0] > 0) return 'attackers_win';
  // Both dead = defenders win (bomb not planted)
  if (ms.aliveCount[0] <= 0 && ms.aliveCount[1] <= 0) return 'defenders_win';

  // Timer expired
  if (ms.phaseTimer <= 0 && !anyArmed) return 'defenders_win';

  return null;
}

function resolveRound(ms: MatchState, outcome: RoundOutcome, events: ModeEvent[]): MatchState {
  const winningTeam: 0 | 1 = outcome === 'attackers_win' ? 0 : 1;
  const newScore: [number, number] = [ms.teamScore[0], ms.teamScore[1]];
  newScore[winningTeam]++;

  // Award round wins in stats
  let s = { ...ms };
  for (const [id, st] of Object.entries(s.stats)) {
    // We don't know team here easily, but score tracks per-team. Skip per-player here.
    void id; void st;
  }

  const roundsToWin = Math.ceil(ms.config.maxRounds / 2) + 1;
  const matchWinner: 0 | 1 | null =
    newScore[0] >= roundsToWin ? 0 :
    newScore[1] >= roundsToWin ? 1 : null;

  events.push({ type: 'round_end', payload: { outcome, round: ms.roundNumber, score: newScore } });

  return {
    ...ms,
    phase: 'round_end',
    phaseTimer: ms.roundEndDelay,
    teamScore: newScore,
    roundOutcome: outcome,
    matchWinner,
    // Reset objectives
    objectives: ms.objectives.map(o => ({ ...o, phase: 'idle' as ObjectivePhase, progress: 0, armedTimer: ms.config.armedDuration, interactingId: null })),
  };
}

function startRound(ms: MatchState): MatchState {
  return {
    ...ms,
    phase: 'active',
    phaseTimer: ms.config.roundDuration,
    roundOutcome: null,
    objectives: ms.objectives.map(o => ({ ...o, phase: 'idle' as ObjectivePhase, progress: 0, armedTimer: ms.config.armedDuration, interactingId: null })),
    killfeed: [],
  };
}
