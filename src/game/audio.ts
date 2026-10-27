// BREACHPOINT — Audio Engine (Phase 2A)
// All sounds are synthesised via Web Audio API — no external downloads or assets needed.
// AudioContext is only created/resumed after the first user gesture (handled in BPRenderer.start).

export interface AudioSpatialSource {
  x: number;
  y: number;
  z: number;
}

// ── Internals ──────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Listener position — updated each frame by the renderer
let listenerX = 0;
let listenerY = 0;
let listenerZ = 0;
let listenerYaw = 0; // radians

// Active one-shot nodes pool — prevent unbounded growth
const MAX_CONCURRENT = 32;
let activeNodes = 0;

function canPlay(): boolean {
  return ctx !== null && ctx.state === 'running' && masterGain !== null && activeNodes < MAX_CONCURRENT;
}

function ensure(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

/** Resume a suspended context — call from the first user gesture */
export function resumeAudio() {
  const c = ensure();
  if (c.state === 'suspended') void c.resume();
}

/** Update listener position/orientation — call every frame */
export function updateListener(x: number, y: number, z: number, yaw: number) {
  listenerX = x; listenerY = y; listenerZ = z; listenerYaw = yaw;
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
    l.forwardX.value = -Math.sin(yaw); l.forwardY.value = 0; l.forwardZ.value = -Math.cos(yaw);
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else {
    l.setPosition(x, y, z);
    l.setOrientation(-Math.sin(yaw), 0, -Math.cos(yaw), 0, 1, 0);
  }
}

/** Set master volume 0–1 — affects all currently playing sounds */
export function setMasterVolume(v: number) {
  ensure();
  if (masterGain) masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx!.currentTime, 0.02);
}

/** Dispose — stop everything and close the context */
export function disposeAudio() {
  if (ctx) {
    void ctx.close();
    ctx = null;
    masterGain = null;
    activeNodes = 0;
  }
}

// ── Low-level helpers ──────────────────────────────────────────────────────

/** Route a node through optional spatial panning to master gain, then auto-clean */
function connect(
  src: AudioNode,
  duration: number,
  spatial: AudioSpatialSource | null,
  gainDb = 0,
) {
  if (!ctx || !masterGain) return;
  activeNodes++;

  const gainNode = ctx.createGain();
  const linearGain = Math.pow(10, gainDb / 20);
  gainNode.gain.value = linearGain;

  if (spatial) {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.maxDistance = 80;
    panner.rolloffFactor = 1.5;
    panner.coneInnerAngle = 360;
    if (panner.positionX) {
      panner.positionX.value = spatial.x;
      panner.positionY.value = spatial.y;
      panner.positionZ.value = spatial.z;
    } else {
      panner.setPosition(spatial.x, spatial.y, spatial.z);
    }
    src.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(masterGain);
  } else {
    src.connect(gainNode);
    gainNode.connect(masterGain);
  }

  // Fade out tail and clean up
  const end = ctx.currentTime + duration + 0.05;
  gainNode.gain.setTargetAtTime(0, ctx.currentTime + duration - 0.02, 0.02);
  setTimeout(() => { activeNodes = Math.max(0, activeNodes - 1); }, (end + 0.1) * 1000 - Date.now() % 1000 + 200);
}

/** Quick one-shot oscillator */
function osc(
  type: OscillatorType,
  freq: number,
  duration: number,
  gainDb: number,
  spatial: AudioSpatialSource | null,
  pitchEnv?: { from: number; to: number; time: number },
  detune = 0,
) {
  if (!canPlay()) return;
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  if (pitchEnv) {
    o.frequency.setValueAtTime(pitchEnv.from, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(pitchEnv.to, c.currentTime + pitchEnv.time);
  }
  connect(o, duration, spatial, gainDb);
  o.start(c.currentTime);
  o.stop(c.currentTime + duration + 0.1);
}

/** Shaped noise burst */
function noise(
  duration: number,
  gainDb: number,
  spatial: AudioSpatialSource | null,
  hpFreq = 0,
  lpFreq = 22000,
) {
  if (!canPlay()) return;
  const c = ctx!;
  const bufLen = Math.ceil(c.sampleRate * Math.min(duration + 0.05, 2));
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const gainNode = c.createGain();
  gainNode.gain.setValueAtTime(Math.pow(10, gainDb / 20), c.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

  src.connect(gainNode);

  let lastNode: AudioNode = gainNode;

  if (hpFreq > 0) {
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;
    lastNode.connect(hp);
    lastNode = hp;
  }
  if (lpFreq < 22000) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lpFreq;
    lastNode.connect(lp);
    lastNode = lp;
  }

  if (spatial && ctx && masterGain) {
    activeNodes++;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.maxDistance = 80;
    panner.rolloffFactor = 1.5;
    if (panner.positionX) {
      panner.positionX.value = spatial.x;
      panner.positionY.value = spatial.y;
      panner.positionZ.value = spatial.z;
    } else {
      panner.setPosition(spatial.x, spatial.y, spatial.z);
    }
    lastNode.connect(panner);
    panner.connect(masterGain);
    setTimeout(() => { activeNodes = Math.max(0, activeNodes - 1); }, (duration + 0.3) * 1000);
  } else if (masterGain) {
    activeNodes++;
    lastNode.connect(masterGain);
    setTimeout(() => { activeNodes = Math.max(0, activeNodes - 1); }, (duration + 0.3) * 1000);
  }

  src.start(ctx!.currentTime);
  src.stop(ctx!.currentTime + duration + 0.1);
}

// ── Public sound events ────────────────────────────────────────────────────

/** Player firing — distinct per weapon */
export function playGunshot(weaponId: string, spatial: AudioSpatialSource | null) {
  if (!canPlay()) return;
  switch (weaponId) {
    case 'pistol':
      // Sharp crack — short noise + tonal snap
      noise(0.08, -6, spatial, 200, 8000);
      osc('sawtooth', 180, 0.06, -12, spatial, { from: 320, to: 80, time: 0.05 });
      break;
    case 'smg':
      // Light rapid rattle
      noise(0.07, -8, spatial, 400, 10000);
      osc('square', 140, 0.05, -18, spatial, { from: 260, to: 90, time: 0.04 });
      break;
    case 'rifle':
      // Medium crack with bass thud
      noise(0.1, -4, spatial, 120, 9000);
      osc('sawtooth', 90, 0.09, -10, spatial, { from: 200, to: 60, time: 0.07 });
      break;
    case 'heavy':
      // Deep boom — more low end
      noise(0.15, -2, spatial, 60, 6000);
      osc('sawtooth', 55, 0.12, -8, spatial, { from: 120, to: 40, time: 0.1 });
      break;
    case 'precision':
      // Loud sharp crack with long tail
      noise(0.18, -3, spatial, 80, 12000);
      osc('sawtooth', 110, 0.14, -9, spatial, { from: 280, to: 50, time: 0.12 });
      break;
    default:
      noise(0.1, -6, spatial, 150, 9000);
  }
}

/** Bullet impact on wall */
export function playBulletImpact(spatial: AudioSpatialSource | null) {
  if (!canPlay()) return;
  noise(0.06, -14, spatial, 600, 7000);
  osc('sawtooth', 120, 0.04, -22, spatial, { from: 200, to: 80, time: 0.03 });
}

/** Hit-marker — confirmed hit on enemy */
export function playHitMarker() {
  if (!canPlay()) return;
  // Two quick high tones
  osc('sine', 1200, 0.04, -10, null);
  setTimeout(() => osc('sine', 1600, 0.03, -12, null), 30);
}

/** Enemy eliminated */
export function playKillConfirm() {
  if (!canPlay()) return;
  // Satisfying double-ping sweep up
  osc('sine', 800, 0.06, -8, null, { from: 800, to: 1400, time: 0.05 });
  setTimeout(() => osc('sine', 1000, 0.08, -8, null, { from: 1000, to: 1800, time: 0.06 }), 40);
}

/** Incoming damage flash */
export function playDamageReceived() {
  if (!canPlay()) return;
  noise(0.12, -8, null, 100, 3000);
  osc('sawtooth', 80, 0.1, -14, null, { from: 160, to: 60, time: 0.08 });
}

/** Player death */
export function playPlayerDeath() {
  if (!canPlay()) return;
  // Low thud + ringing tone going silent
  noise(0.2, -4, null, 40, 2000);
  osc('sine', 440, 0.5, -10, null, { from: 440, to: 80, time: 0.4 });
  // High-frequency tinnitus effect
  osc('sine', 4000, 0.3, -18, null, { from: 4000, to: 2000, time: 0.25 });
}

/** Empty magazine click */
export function playEmptyMag() {
  if (!canPlay()) return;
  noise(0.03, -10, null, 2000, 12000);
  osc('square', 800, 0.02, -16, null);
}

/** Reload start (magazine out) */
export function playReloadStart() {
  if (!canPlay()) return;
  noise(0.1, -12, null, 500, 8000);
  osc('sine', 240, 0.08, -18, null, { from: 300, to: 180, time: 0.07 });
}

/** Reload complete (magazine seated) */
export function playReloadComplete() {
  if (!canPlay()) return;
  noise(0.07, -10, null, 800, 10000);
  osc('sine', 320, 0.06, -14, null, { from: 200, to: 380, time: 0.05 });
}

// ── Footsteps ──────────────────────────────────────────────────────────────

let lastFootstepTime = 0;

/** Play a footstep — cadence enforced internally */
export function playFootstep(sprinting: boolean, crouching: boolean) {
  if (!canPlay()) return;
  const now = ctx!.currentTime;
  const cadence = crouching ? 0.55 : sprinting ? 0.25 : 0.40;
  if (now - lastFootstepTime < cadence) return;
  lastFootstepTime = now;

  const gainDb = crouching ? -20 : sprinting ? -12 : -16;
  noise(0.07, gainDb, null, 80, 1200);
  osc('sine', 60, 0.06, gainDb - 4, null, { from: 80, to: 40, time: 0.05 });
}

/** Jump liftoff */
export function playJump() {
  if (!canPlay()) return;
  osc('sine', 120, 0.07, -14, null, { from: 180, to: 80, time: 0.06 });
}

/** Land impact */
export function playLand(hard: boolean) {
  if (!canPlay()) return;
  const db = hard ? -8 : -14;
  noise(0.1, db, null, 60, 1500);
  osc('sine', 70, 0.09, db - 4, null, { from: 100, to: 45, time: 0.08 });
}

// ── Objective sounds ───────────────────────────────────────────────────────

/** E-hold interaction tick (plays while holding) */
let lastBeepTime = 0;
export function playObjectiveBeep(progress: number) {
  if (!canPlay()) return;
  const now = ctx!.currentTime;
  if (now - lastBeepTime < 0.12) return;
  lastBeepTime = now;
  const pitch = 600 + progress * 400;
  osc('sine', pitch, 0.06, -12, null);
}

/** Objective armed / bomb planted */
export function playObjectiveArmed() {
  if (!canPlay()) return;
  // Menacing low drone + alarm beep
  osc('sawtooth', 60, 0.4, -8, null, { from: 60, to: 55, time: 0.35 });
  osc('sine', 880, 0.1, -10, null);
  setTimeout(() => osc('sine', 880, 0.1, -10, null), 200);
  setTimeout(() => osc('sine', 1100, 0.12, -8, null), 400);
}

/** Objective defused */
export function playObjectiveDefused() {
  if (!canPlay()) return;
  osc('sine', 440, 0.08, -8, null);
  setTimeout(() => osc('sine', 660, 0.1, -8, null), 80);
  setTimeout(() => osc('sine', 880, 0.15, -6, null), 160);
  setTimeout(() => osc('sine', 1320, 0.2, -6, null), 260);
}

/** Objective detonated / exploded */
export function playExplosion(spatial: AudioSpatialSource | null) {
  if (!canPlay()) return;
  noise(0.8, 0, spatial, 20, 3000);
  osc('sawtooth', 40, 0.6, -4, spatial, { from: 80, to: 20, time: 0.5 });
  // Rumble
  osc('sine', 30, 1.0, -6, spatial, { from: 50, to: 25, time: 0.8 });
}

/** Fuse warning beep — plays when armedTimer is low */
export function playFuseWarning() {
  if (!canPlay()) return;
  osc('square', 880, 0.05, -12, null);
}

// ── Match events ───────────────────────────────────────────────────────────

/** Round start / warmup end */
export function playRoundStart() {
  if (!canPlay()) return;
  osc('sine', 330, 0.15, -8, null);
  setTimeout(() => osc('sine', 440, 0.15, -8, null), 150);
  setTimeout(() => osc('sine', 660, 0.25, -6, null), 300);
}

/** Round end */
export function playRoundEnd(attackersWon: boolean) {
  if (!canPlay()) return;
  if (attackersWon) {
    osc('sawtooth', 220, 0.2, -10, null, { from: 220, to: 180, time: 0.18 });
    setTimeout(() => osc('sawtooth', 180, 0.25, -10, null, { from: 180, to: 140, time: 0.22 }), 200);
  } else {
    osc('sine', 440, 0.12, -10, null);
    setTimeout(() => osc('sine', 550, 0.15, -10, null), 120);
    setTimeout(() => osc('sine', 660, 0.2, -8, null), 250);
  }
}

/** Match end */
export function playMatchEnd(playerWon: boolean) {
  if (!canPlay()) return;
  if (playerWon) {
    // Ascending fanfare
    [330, 440, 550, 660, 880].forEach((f, i) => {
      setTimeout(() => osc('sine', f, 0.25 + i * 0.03, -6, null), i * 100);
    });
  } else {
    // Descending minor
    [440, 370, 330, 220].forEach((f, i) => {
      setTimeout(() => osc('sawtooth', f, 0.2, -10, null), i * 120);
    });
  }
}

/** UI menu click */
export function playMenuClick() {
  if (!canPlay()) return;
  osc('sine', 600, 0.04, -14, null);
}

/** UI menu confirm / deploy */
export function playMenuConfirm() {
  if (!canPlay()) return;
  osc('sine', 440, 0.05, -12, null);
  setTimeout(() => osc('sine', 660, 0.07, -10, null), 40);
}
