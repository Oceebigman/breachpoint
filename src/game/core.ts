// BREACHPOINT — Game Core: lifecycle, clock, state machine, event bus

export type GamePhase =
  | 'menu'
  | 'lobby'
  | 'warmup'
  | 'active'
  | 'round_result'
  | 'match_result'
  | 'paused';

type Listener<T = unknown> = (data: T) => void;

class EventBus {
  private listeners: Map<string, Listener[]> = new Map();

  on<T = unknown>(event: string, fn: Listener<T>) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn as Listener);
  }

  off<T = unknown>(event: string, fn: Listener<T>) {
    const arr = this.listeners.get(event);
    if (!arr) return;
    this.listeners.set(event, arr.filter(f => f !== fn));
  }

  emit<T = unknown>(event: string, data?: T) {
    const arr = this.listeners.get(event);
    if (!arr) return;
    for (const fn of arr) fn(data);
  }
}

export const bus = new EventBus();

export class GameClock {
  private lastTime = 0;
  private _delta = 0;
  private _elapsed = 0;

  tick(timestamp: number) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    this._delta = Math.min((timestamp - this.lastTime) / 1000, 0.1); // cap at 100ms
    this._elapsed += this._delta;
    this.lastTime = timestamp;
  }

  get delta() { return this._delta; }
  get elapsed() { return this._elapsed; }

  reset() {
    this.lastTime = 0;
    this._delta = 0;
    this._elapsed = 0;
  }
}

export const clock = new GameClock();
