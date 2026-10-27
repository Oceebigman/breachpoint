// BREACHPOINT — Bot AI: patrol, engage, navigate, objective decisions

import * as THREE from 'three';
import { MapDef, AABB, resolveCollision, raycastAABB } from './world';
import { WeaponState, WeaponId, createWeaponState, tickWeapon, tryFire, tryReload, calcDamage } from './weapons';
import { bus } from './core';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export type BotState = 'patrol' | 'investigate' | 'engage' | 'goto_objective' | 'defend_objective' | 'stuck';

export interface Bot {
  id: string;
  team: 0 | 1;
  position: THREE.Vector3;
  yaw: number;          // radians
  pitch: number;
  health: number;
  alive: boolean;
  weapon: WeaponState;
  state: BotState;
  targetPos: THREE.Vector3 | null;
  targetPlayerId: string | null;
  stuckTimer: number;
  lastPos: THREE.Vector3;
  stateTimer: number;   // time in current state
  reactionTimer: number;// time until bot can react to a new stimulus
  difficulty: BotDifficulty;
  patrolIndex: number;
}

const DIFF_PARAMS: Record<BotDifficulty, { reaction: number; aimError: number; awareDist: number }> = {
  easy:   { reaction: 0.8, aimError: 5,   awareDist: 20 },
  normal: { reaction: 0.4, aimError: 2,   awareDist: 35 },
  hard:   { reaction: 0.15, aimError: 0.5, awareDist: 50 },
};

const BOT_SPEED = 6;
const BOT_RADIUS = 0.35;
const BOT_HEIGHT = 1.7;
const FIRE_DIST = 30;

export function createBot(
  id: string,
  team: 0 | 1,
  spawn: THREE.Vector3,
  yaw: number,
  difficulty: BotDifficulty,
  weaponId: WeaponId = 'rifle',
): Bot {
  return {
    id,
    team,
    position: spawn.clone(),
    yaw,
    pitch: 0,
    health: 100,
    alive: true,
    weapon: createWeaponState(weaponId),
    state: 'patrol',
    targetPos: null,
    targetPlayerId: null,
    stuckTimer: 0,
    lastPos: spawn.clone(),
    stateTimer: 0,
    reactionTimer: DIFF_PARAMS[difficulty].reaction,
    difficulty,
    patrolIndex: 0,
  };
}

export interface BotTickInput {
  bot: Bot;
  dt: number;
  map: MapDef;
  /** All alive entities (player + bots) with position, team, id */
  entities: { id: string; team: 0 | 1; position: THREE.Vector3; alive: boolean }[];
  objectivePos: THREE.Vector3 | null;
  isAttacker: boolean; // team 0 = attacker by default
}

export interface BotTickResult {
  bot: Bot;
  shotFired: boolean;
  /** id of entity hit, or null */
  hitId: string | null;
  hitDamage: number;
}

export function tickBot(input: BotTickInput): BotTickResult {
  let bot: Bot = { ...input.bot };
  const { dt, map, entities, objectivePos } = input;
  const params = DIFF_PARAMS[bot.difficulty];
  let shotFired = false;
  let hitId: string | null = null;
  let hitDamage = 0;

  if (!bot.alive) return { bot, shotFired, hitId, hitDamage };

  // Tick weapon
  bot.weapon = tickWeapon(bot.weapon, dt);

  // Tick timers
  bot.stateTimer += dt;
  bot.reactionTimer = Math.max(0, bot.reactionTimer - dt);

  // --- Perception: find nearest visible enemy ---
  let nearestEnemy: { id: string; pos: THREE.Vector3; dist: number } | null = null;
  if (bot.reactionTimer <= 0) {
    for (const e of entities) {
      if (!e.alive || e.team === bot.team || e.id === bot.id) continue;
      const dist = bot.position.distanceTo(e.position);
      if (dist > params.awareDist) continue;
      // Simple LOS check using map colliders
      if (hasLineOfSight(bot.position, e.position, map.colliders)) {
        if (!nearestEnemy || dist < nearestEnemy.dist) {
          nearestEnemy = { id: e.id, pos: e.position.clone(), dist };
        }
      }
    }
  }

  // --- State transitions ---
  if (nearestEnemy) {
    bot.targetPlayerId = nearestEnemy.id;
    bot.state = 'engage';
    bot.stateTimer = 0;
    bot.reactionTimer = params.reaction;
  } else if (bot.state === 'engage' && bot.stateTimer > 2.5) {
    // Lost target
    bot.targetPlayerId = null;
    bot.state = bot.stateTimer > 5 ? 'patrol' : 'investigate';
    bot.stateTimer = 0;
  }

  if (bot.state !== 'engage' && objectivePos) {
    const distToObj = bot.position.distanceTo(objectivePos);
    if (input.isAttacker) {
      if (distToObj > 5) { bot.state = 'goto_objective'; }
      else { bot.state = 'defend_objective'; }
    } else {
      if (distToObj < 20) bot.state = 'defend_objective';
    }
  }

  // --- State actions ---
  const move = new THREE.Vector3();

  if (bot.state === 'engage' && nearestEnemy) {
    // Face enemy + shoot
    const dir = nearestEnemy.pos.clone().sub(bot.position);
    const targetYaw = Math.atan2(dir.x, dir.z);
    const targetPitch = -Math.atan2(dir.y - 1.6, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
    bot.yaw = lerpAngle(bot.yaw, targetYaw, dt * 4);
    bot.pitch = THREE.MathUtils.lerp(bot.pitch, targetPitch, dt * 3);

    // Add aim error
    const errYaw = (Math.random() - 0.5) * params.aimError * (Math.PI / 180);
    const errPitch = (Math.random() - 0.5) * params.aimError * (Math.PI / 180);

    if (nearestEnemy.dist < FIRE_DIST) {
      const result = tryFire(bot.weapon, nearestEnemy.dist < 10, false);
      bot.weapon = result.ws;
      if (result.fired) {
        shotFired = true;
        // Raycast from bot eye
        const eyePos = bot.position.clone().add(new THREE.Vector3(0, 1.55, 0));
        const fireYaw = bot.yaw + errYaw;
        const firePitch = bot.pitch + errPitch;
        const fireDir = new THREE.Vector3(
          Math.sin(fireYaw) * Math.cos(firePitch),
          Math.sin(firePitch),
          Math.cos(fireYaw) * Math.cos(firePitch),
        ).normalize();

        const hit = raycastEntities(eyePos, fireDir, entities, bot.id, bot.team, map.colliders, result.spread);
        if (hit) {
          hitId = hit.id;
          hitDamage = calcDamage(bot.weapon.def, hit.dist);
        }
      }
    }

    // Auto-reload
    if (bot.weapon.ammoInMag === 0) {
      bot.weapon = tryReload(bot.weapon);
    }

    // Strafe slightly
    const right = new THREE.Vector3(Math.cos(bot.yaw), 0, -Math.sin(bot.yaw));
    if (bot.stateTimer < 1) move.addScaledVector(right, Math.sin(bot.stateTimer * 3) * 2);

  } else if (bot.state === 'goto_objective' && objectivePos) {
    const target = findNextNavNode(bot.position, objectivePos, map.navNodes, map.colliders);
    moveBotToward(bot, target, move, dt);

  } else if (bot.state === 'defend_objective' && objectivePos) {
    // Face objective area, stay near
    const dir = objectivePos.clone().sub(bot.position);
    if (dir.lengthSq() > 0.01) {
      bot.yaw = lerpAngle(bot.yaw, Math.atan2(dir.x, dir.z), dt * 2);
    }
    if (bot.position.distanceTo(objectivePos) > 6) {
      moveBotToward(bot, objectivePos, move, dt);
    }

  } else if (bot.state === 'patrol' || bot.state === 'investigate') {
    if (!bot.targetPos || bot.position.distanceTo(bot.targetPos) < 1.5) {
      bot.patrolIndex = (bot.patrolIndex + 1) % map.navNodes.length;
      bot.targetPos = map.navNodes[bot.patrolIndex].clone();
    }
    moveBotToward(bot, bot.targetPos, move, dt);
  }

  // --- Move + collide ---
  if (move.lengthSq() > 0.001) {
    move.normalize().multiplyScalar(BOT_SPEED * dt);
    const next = bot.position.clone().add(move);
    bot.position = resolveCollision(next, BOT_RADIUS, BOT_HEIGHT, map.colliders);
  }

  // --- Stuck detection ---
  if (bot.position.distanceTo(bot.lastPos) < 0.05 * dt * BOT_SPEED && bot.state !== 'defend_objective') {
    bot.stuckTimer += dt;
    if (bot.stuckTimer > 1.5) {
      // Teleport to nearest nav node
      const nearNav = nearest(bot.position, map.navNodes);
      if (nearNav) bot.position.copy(nearNav);
      bot.stuckTimer = 0;
      bot.state = 'patrol';
    }
  } else {
    bot.stuckTimer = 0;
  }
  bot.lastPos = bot.position.clone();

  return { bot, shotFired, hitId, hitDamage };
}

// --- Helpers ---

function moveBotToward(bot: Bot, target: THREE.Vector3, move: THREE.Vector3, _dt: number) {
  const dir = target.clone().sub(bot.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) return;
  dir.normalize();
  move.add(dir);
  bot.yaw = lerpAngle(bot.yaw, Math.atan2(dir.x, dir.z), _dt * 3);
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.min(t, 1);
}

function nearest(pos: THREE.Vector3, nodes: THREE.Vector3[]): THREE.Vector3 | null {
  let best: THREE.Vector3 | null = null;
  let bestD = Infinity;
  for (const n of nodes) {
    const d = pos.distanceToSquared(n);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

function findNextNavNode(
  from: THREE.Vector3,
  to: THREE.Vector3,
  nodes: THREE.Vector3[],
  colliders: AABB[],
): THREE.Vector3 {
  // Greedy: pick the node closest to destination that we can see from current pos
  let best: THREE.Vector3 = to;
  let bestScore = Infinity;
  for (const n of nodes) {
    const distToGoal = n.distanceTo(to);
    if (distToGoal < bestScore && hasLineOfSight(from, n, colliders)) {
      bestScore = distToGoal;
      best = n;
    }
  }
  return best;
}

function hasLineOfSight(a: THREE.Vector3, b: THREE.Vector3, colliders: AABB[]): boolean {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 0.01) return true;
  dir.divideScalar(len);
  const eyeA = a.clone().add(new THREE.Vector3(0, 1.4, 0));
  for (const c of colliders) {
    const t = raycastAABB(eyeA, dir, c);
    if (t < len - 0.5) return false;
  }
  return true;
}

function raycastEntities(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  entities: { id: string; team: 0 | 1; position: THREE.Vector3; alive: boolean }[],
  selfId: string,
  selfTeam: number,
  colliders: AABB[],
  spreadDeg: number,
): { id: string; dist: number } | null {
  // Apply spread
  const spreadRad = (spreadDeg * Math.PI) / 180;
  const fireDir = dir.clone();
  fireDir.x += (Math.random() - 0.5) * spreadRad * 2;
  fireDir.z += (Math.random() - 0.5) * spreadRad * 2;
  fireDir.normalize();

  // Check wall occlusion first
  let wallDist = Infinity;
  for (const c of colliders) {
    const t = raycastAABB(origin, fireDir, c);
    if (t < wallDist) wallDist = t;
  }

  let bestDist = Infinity;
  let bestId: string | null = null;
  for (const e of entities) {
    if (!e.alive || e.id === selfId || e.team === selfTeam) continue;
    // Sphere approximation
    const toE = e.position.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(origin);
    const proj = toE.dot(fireDir);
    if (proj <= 0) continue;
    const closest = origin.clone().addScaledVector(fireDir, proj);
    const dist2 = closest.distanceToSquared(e.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    if (dist2 < 0.6 * 0.6 && proj < bestDist && proj < wallDist) {
      bestDist = proj;
      bestId = e.id;
    }
  }
  return bestId ? { id: bestId, dist: bestDist } : null;
}

bus.on('bot_hit', (_data) => { /* placeholder for future networked bot hit handling */ });
