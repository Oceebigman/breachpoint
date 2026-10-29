// BREACHPOINT — Weapon View Model
// Procedural first-person rifle built from multi-part Three.js geometry.
// Handles hip/ADS positioning, recoil, sway, movement bob, sprint tilt,
// reload animation and muzzle flash — all with zero external assets.

import * as THREE from 'three';
import type { WeaponId } from './weapons';
import { clock } from './core';

// ─── Shared geometry/material cache (reused across weapon swaps) ─────────────

const GEO_CACHE = new Map<string, THREE.BufferGeometry>();
const MAT_CACHE = new Map<string, THREE.Material>();

function box(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `box_${w}_${h}_${d}`;
  if (!GEO_CACHE.has(key)) GEO_CACHE.set(key, new THREE.BoxGeometry(w, h, d));
  return GEO_CACHE.get(key) as THREE.BoxGeometry;
}

function cyl(rt: number, rb: number, h: number, segs = 8): THREE.CylinderGeometry {
  const key = `cyl_${rt}_${rb}_${h}_${segs}`;
  if (!GEO_CACHE.has(key)) GEO_CACHE.set(key, new THREE.CylinderGeometry(rt, rb, h, segs));
  return GEO_CACHE.get(key) as THREE.CylinderGeometry;
}

function mat(color: number, roughness = 0.6, metalness = 0.4): THREE.MeshStandardMaterial {
  const key = `std_${color}_${roughness}_${metalness}`;
  if (!MAT_CACHE.has(key)) {
    MAT_CACHE.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }
  return MAT_CACHE.get(key) as THREE.MeshStandardMaterial;
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const C_RECEIVER  = 0x1c1c1c; // dark matte black metal
const C_BARREL    = 0x2a2a2a; // slightly lighter barrel steel
const C_HANDGUARD = 0x222222; // polymer handguard
const C_GRIP      = 0x111111; // rubber pistol grip
const C_STOCK     = 0x1a1a1a; // polymer stock
const C_MAGAZINE  = 0x1e1e1e; // magazine polymer
const C_RAIL      = 0x252525; // rail system
const C_OPTIC     = 0x1a1a28; // slightly blue-tinted optic housing
const C_LENS      = 0x2244aa; // optic lens
const C_MUZZLE    = 0x323232; // muzzle device

// ─── Per-weapon presentation config ──────────────────────────────────────────

interface WeaponConfig {
  // hip position offset from camera (right, down, forward)
  hipPos: THREE.Vector3;
  hipRot: THREE.Euler;
  // ADS position (sights center-screen)
  adsPos: THREE.Vector3;
  adsRot: THREE.Euler;
  // scale factor
  scale: number;
  // sprint tilt (Z rotation)
  sprintTilt: number;
}

const WEAPON_CONFIGS: Record<WeaponId, WeaponConfig> = {
  rifle: {
    hipPos: new THREE.Vector3(0.14, -0.13, -0.32),
    hipRot: new THREE.Euler(0.04, -0.06, 0.04),
    adsPos: new THREE.Vector3(0.0, -0.085, -0.28),
    adsRot: new THREE.Euler(0.0, 0.0, 0.0),
    scale: 1.0,
    sprintTilt: 0.35,
  },
  smg: {
    hipPos: new THREE.Vector3(0.12, -0.12, -0.28),
    hipRot: new THREE.Euler(0.03, -0.05, 0.03),
    adsPos: new THREE.Vector3(0.0, -0.082, -0.24),
    adsRot: new THREE.Euler(0.0, 0.0, 0.0),
    scale: 0.82,
    sprintTilt: 0.3,
  },
  pistol: {
    hipPos: new THREE.Vector3(0.10, -0.11, -0.24),
    hipRot: new THREE.Euler(0.02, -0.04, 0.02),
    adsPos: new THREE.Vector3(0.0, -0.075, -0.20),
    adsRot: new THREE.Euler(0.0, 0.0, 0.0),
    scale: 0.65,
    sprintTilt: 0.25,
  },
  heavy: {
    hipPos: new THREE.Vector3(0.16, -0.15, -0.36),
    hipRot: new THREE.Euler(0.05, -0.07, 0.05),
    adsPos: new THREE.Vector3(0.0, -0.092, -0.30),
    adsRot: new THREE.Euler(0.0, 0.0, 0.0),
    scale: 1.25,
    sprintTilt: 0.4,
  },
  precision: {
    hipPos: new THREE.Vector3(0.14, -0.13, -0.38),
    hipRot: new THREE.Euler(0.03, -0.05, 0.03),
    adsPos: new THREE.Vector3(0.0, -0.088, -0.32),
    adsRot: new THREE.Euler(0.0, 0.0, 0.0),
    scale: 1.1,
    sprintTilt: 0.38,
  },
};

// ─── Muzzle flash ─────────────────────────────────────────────────────────────

function buildMuzzleFlash(): THREE.Group {
  const g = new THREE.Group();

  // Bright point light (very short range)
  const light = new THREE.PointLight(0xff8800, 4, 1.2);
  g.add(light);

  // Cross sprite — two thin planes rotated 90° to each other
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffdd44,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flashGeo = new THREE.PlaneGeometry(0.07, 0.07);

  const p1 = new THREE.Mesh(flashGeo, flashMat);
  const p2 = new THREE.Mesh(flashGeo, flashMat);
  p2.rotation.y = Math.PI / 2;
  const p3 = new THREE.Mesh(flashGeo, flashMat);
  p3.rotation.x = Math.PI / 2;

  g.add(p1, p2, p3);
  g.visible = false;
  return g;
}

// ─── Rifle builder ─────────────────────────────────────────────────────────

function buildRifle(): THREE.Group {
  const root = new THREE.Group();

  // ── Receiver (upper + lower) ──────────────────────────────────────────────
  const upper = new THREE.Mesh(box(0.04, 0.036, 0.22), mat(C_RECEIVER, 0.55, 0.5));
  upper.position.set(0, 0.006, 0);
  root.add(upper);

  const lower = new THREE.Mesh(box(0.038, 0.03, 0.14), mat(C_RECEIVER, 0.6, 0.45));
  lower.position.set(0, -0.02, 0.02);
  root.add(lower);

  // ── Barrel ───────────────────────────────────────────────────────────────
  const barrel = new THREE.Mesh(cyl(0.007, 0.007, 0.28, 8), mat(C_BARREL, 0.4, 0.7));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0.006, -0.25); // extends forward
  root.add(barrel);

  // ── Handguard (quad-rail) ─────────────────────────────────────────────────
  const hg = new THREE.Mesh(box(0.046, 0.042, 0.17), mat(C_HANDGUARD, 0.65, 0.25));
  hg.position.set(0, 0.004, -0.115);
  root.add(hg);

  // Rail ridges — top & sides
  for (let i = -1; i <= 1; i += 2) {
    const sideRail = new THREE.Mesh(box(0.006, 0.048, 0.17), mat(C_RAIL, 0.5, 0.4));
    sideRail.position.set(i * 0.026, 0.004, -0.115);
    root.add(sideRail);
  }
  const topRail = new THREE.Mesh(box(0.046, 0.006, 0.22), mat(C_RAIL, 0.5, 0.4));
  topRail.position.set(0, 0.03, -0.06);
  root.add(topRail);

  // ── Pistol grip ───────────────────────────────────────────────────────────
  const grip = new THREE.Mesh(box(0.028, 0.07, 0.038), mat(C_GRIP, 0.85, 0.1));
  grip.position.set(0, -0.055, 0.065);
  grip.rotation.x = 0.28; // slight rake
  root.add(grip);

  // ── Magazine ──────────────────────────────────────────────────────────────
  const mag = new THREE.Mesh(box(0.028, 0.085, 0.032), mat(C_MAGAZINE, 0.7, 0.2));
  mag.position.set(0, -0.068, 0.022);
  mag.rotation.x = 0.1;
  root.add(mag);

  // ── Stock ─────────────────────────────────────────────────────────────────
  // Collapsible buffer tube
  const tube = new THREE.Mesh(cyl(0.012, 0.012, 0.1, 8), mat(C_STOCK, 0.6, 0.35));
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0, 0.004, 0.16);
  root.add(tube);

  // Cheek rest / butt plate
  const butt = new THREE.Mesh(box(0.036, 0.048, 0.022), mat(C_STOCK, 0.7, 0.2));
  butt.position.set(0, 0.0, 0.22);
  root.add(butt);

  // Folding brace panel
  const cheek = new THREE.Mesh(box(0.034, 0.024, 0.08), mat(C_STOCK, 0.72, 0.18));
  cheek.position.set(0, 0.02, 0.185);
  root.add(cheek);

  // ── Optic (holographic-style) ─────────────────────────────────────────────
  const opticBody = new THREE.Mesh(box(0.024, 0.028, 0.042), mat(C_OPTIC, 0.5, 0.55));
  opticBody.position.set(0, 0.042, -0.02);
  root.add(opticBody);

  // Lens aperture
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.009, 12),
    new THREE.MeshBasicMaterial({ color: C_LENS, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  lens.position.set(0, 0.042, -0.042);
  root.add(lens);

  // Rear glass
  const lensBack = new THREE.Mesh(
    new THREE.CircleGeometry(0.009, 12),
    new THREE.MeshBasicMaterial({ color: C_LENS, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  lensBack.position.set(0, 0.042, 0.001);
  root.add(lensBack);

  // ── Muzzle device ─────────────────────────────────────────────────────────
  const muzzleDevice = new THREE.Mesh(cyl(0.011, 0.009, 0.04, 8), mat(C_MUZZLE, 0.45, 0.65));
  muzzleDevice.rotation.z = Math.PI / 2;
  muzzleDevice.position.set(0, 0.006, -0.375);
  root.add(muzzleDevice);

  // Flash-hider prongs (3 prongs)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const prong = new THREE.Mesh(box(0.004, 0.016, 0.022), mat(C_MUZZLE, 0.45, 0.65));
    prong.position.set(Math.cos(angle) * 0.012, 0.006 + Math.sin(angle) * 0.012, -0.4);
    root.add(prong);
  }

  return root;
}

function buildSMG(): THREE.Group {
  const root = new THREE.Group();

  const body = new THREE.Mesh(box(0.038, 0.04, 0.185), mat(C_RECEIVER, 0.55, 0.5));
  body.position.set(0, 0, 0);
  root.add(body);

  const barrel = new THREE.Mesh(cyl(0.007, 0.007, 0.16, 8), mat(C_BARREL, 0.4, 0.7));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0.004, -0.17);
  root.add(barrel);

  const hg = new THREE.Mesh(box(0.04, 0.036, 0.11), mat(C_HANDGUARD, 0.65, 0.25));
  hg.position.set(0, -0.001, -0.095);
  root.add(hg);

  const grip = new THREE.Mesh(box(0.026, 0.064, 0.034), mat(C_GRIP, 0.85, 0.1));
  grip.position.set(0, -0.05, 0.05);
  grip.rotation.x = 0.25;
  root.add(grip);

  const mag = new THREE.Mesh(box(0.022, 0.072, 0.026), mat(C_MAGAZINE, 0.7, 0.2));
  mag.position.set(0, -0.058, 0.015);
  mag.rotation.x = 0.08;
  root.add(mag);

  const stock = new THREE.Mesh(box(0.034, 0.028, 0.06), mat(C_STOCK, 0.65, 0.3));
  stock.position.set(0, 0.002, 0.125);
  root.add(stock);

  const muzzle = new THREE.Mesh(cyl(0.009, 0.008, 0.028, 8), mat(C_MUZZLE, 0.45, 0.65));
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(0, 0.004, -0.264);
  root.add(muzzle);

  return root;
}

function buildPistol(): THREE.Group {
  const root = new THREE.Group();

  const slide = new THREE.Mesh(box(0.03, 0.034, 0.14), mat(C_RECEIVER, 0.5, 0.55));
  slide.position.set(0, 0.004, 0);
  root.add(slide);

  const frame = new THREE.Mesh(box(0.028, 0.026, 0.11), mat(C_GRIP, 0.75, 0.2));
  frame.position.set(0, -0.016, 0.01);
  root.add(frame);

  const grip = new THREE.Mesh(box(0.028, 0.062, 0.03), mat(C_GRIP, 0.85, 0.1));
  grip.position.set(0, -0.05, 0.052);
  grip.rotation.x = 0.22;
  root.add(grip);

  const mag = new THREE.Mesh(box(0.022, 0.058, 0.022), mat(C_MAGAZINE, 0.7, 0.2));
  mag.position.set(0, -0.046, 0.044);
  mag.rotation.x = 0.15;
  root.add(mag);

  const barrel = new THREE.Mesh(cyl(0.006, 0.006, 0.12, 8), mat(C_BARREL, 0.4, 0.7));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0.004, -0.105);
  root.add(barrel);

  const sight = new THREE.Mesh(box(0.008, 0.01, 0.008), mat(C_RAIL, 0.5, 0.45));
  sight.position.set(0, 0.026, -0.03);
  root.add(sight);

  return root;
}

function buildHeavy(): THREE.Group {
  const root = new THREE.Group();

  const body = new THREE.Mesh(box(0.052, 0.046, 0.26), mat(C_RECEIVER, 0.55, 0.5));
  root.add(body);

  const barrel = new THREE.Mesh(cyl(0.009, 0.009, 0.34, 8), mat(C_BARREL, 0.4, 0.7));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0.006, -0.3);
  root.add(barrel);

  const bipodL = new THREE.Mesh(box(0.006, 0.044, 0.008), mat(C_RAIL, 0.5, 0.4));
  bipodL.position.set(-0.022, -0.035, -0.18);
  root.add(bipodL);
  const bipodR = bipodL.clone();
  bipodR.position.x = 0.022;
  root.add(bipodR);

  const hg = new THREE.Mesh(box(0.055, 0.048, 0.2), mat(C_HANDGUARD, 0.65, 0.25));
  hg.position.set(0, 0.002, -0.13);
  root.add(hg);

  const grip = new THREE.Mesh(box(0.032, 0.078, 0.044), mat(C_GRIP, 0.85, 0.1));
  grip.position.set(0, -0.062, 0.074);
  grip.rotation.x = 0.28;
  root.add(grip);

  const mag = new THREE.Mesh(box(0.048, 0.032, 0.038), mat(C_MAGAZINE, 0.7, 0.2));
  mag.position.set(0, -0.038, 0.03);
  root.add(mag);

  const stock = new THREE.Mesh(box(0.044, 0.054, 0.11), mat(C_STOCK, 0.65, 0.3));
  stock.position.set(0, 0.002, 0.19);
  root.add(stock);

  const optic = new THREE.Mesh(box(0.03, 0.034, 0.055), mat(C_OPTIC, 0.5, 0.55));
  optic.position.set(0, 0.048, -0.02);
  root.add(optic);

  return root;
}

function buildPrecision(): THREE.Group {
  const root = new THREE.Group();

  const action = new THREE.Mesh(box(0.042, 0.038, 0.2), mat(C_RECEIVER, 0.5, 0.55));
  root.add(action);

  const barrel = new THREE.Mesh(cyl(0.009, 0.008, 0.4, 8), mat(C_BARREL, 0.35, 0.75));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0.004, -0.3);
  root.add(barrel);

  // Fluted barrel detail
  for (let i = 0; i < 6; i++) {
    const flute = new THREE.Mesh(box(0.004, 0.004, 0.32), mat(C_BARREL, 0.4, 0.7));
    const a = (i / 6) * Math.PI * 2;
    flute.position.set(Math.cos(a) * 0.009, 0.004 + Math.sin(a) * 0.009, -0.28);
    root.add(flute);
  }

  const stock = new THREE.Mesh(box(0.038, 0.044, 0.22), mat(C_STOCK, 0.7, 0.2));
  stock.position.set(0, -0.002, 0.2);
  root.add(stock);

  const cheekPiece = new THREE.Mesh(box(0.036, 0.02, 0.1), mat(C_STOCK, 0.68, 0.22));
  cheekPiece.position.set(0, 0.03, 0.16);
  root.add(cheekPiece);

  const grip = new THREE.Mesh(box(0.028, 0.068, 0.036), mat(C_GRIP, 0.85, 0.1));
  grip.position.set(0, -0.052, 0.065);
  grip.rotation.x = 0.3;
  root.add(grip);

  const mag = new THREE.Mesh(box(0.028, 0.058, 0.026), mat(C_MAGAZINE, 0.7, 0.2));
  mag.position.set(0, -0.046, 0.02);
  root.add(mag);

  // Scope — long tube
  const scopeTube = new THREE.Mesh(cyl(0.014, 0.014, 0.19, 12), mat(C_OPTIC, 0.5, 0.55));
  scopeTube.rotation.z = Math.PI / 2;
  scopeTube.position.set(0, 0.052, -0.04);
  root.add(scopeTube);

  // Scope objective bell
  const bell = new THREE.Mesh(cyl(0.018, 0.014, 0.04, 12), mat(C_OPTIC, 0.5, 0.55));
  bell.rotation.z = Math.PI / 2;
  bell.position.set(0, 0.052, -0.135);
  root.add(bell);

  // Scope lens
  const scopeLens = new THREE.Mesh(
    new THREE.CircleGeometry(0.015, 12),
    new THREE.MeshBasicMaterial({ color: 0x2255cc, transparent: true, opacity: 0.75 }),
  );
  scopeLens.position.set(0, 0.052, -0.157);
  root.add(scopeLens);

  // Muzzle brake
  const brake = new THREE.Mesh(cyl(0.013, 0.013, 0.038, 8), mat(C_MUZZLE, 0.4, 0.7));
  brake.rotation.z = Math.PI / 2;
  brake.position.set(0, 0.004, -0.505);
  root.add(brake);

  // Suppressor-style ports on muzzle brake
  for (let i = 0; i < 4; i++) {
    const port = new THREE.Mesh(box(0.016, 0.006, 0.005), mat(0x111111, 0.9, 0.1));
    port.position.set(0, 0.004, -0.485 - i * 0.009);
    root.add(port);
  }

  return root;
}

// Map weapon ID to builder
function buildWeaponMesh(id: WeaponId): THREE.Group {
  switch (id) {
    case 'rifle':     return buildRifle();
    case 'smg':       return buildSMG();
    case 'pistol':    return buildPistol();
    case 'heavy':     return buildHeavy();
    case 'precision': return buildPrecision();
    default:          return buildRifle();
  }
}

// ─── Reusable scratch vectors (avoid per-frame allocation) ────────────────────

const _v3 = new THREE.Vector3();
const _q  = new THREE.Quaternion();

// ─── WeaponViewModel ─────────────────────────────────────────────────────────

export class WeaponViewModel {
  /** The root group — add this to the scene and call update() every frame. */
  readonly group: THREE.Group;

  private weaponGroup: THREE.Group;
  private muzzleFlashGroup: THREE.Group;
  private muzzlePivot: THREE.Group;  // positioned at muzzle tip

  private cfg: WeaponConfig;

  // ── Animation state ───────────────────────────────────────────────────────

  // Smooth position/rotation targets (lerped toward each frame)
  private posTarget = new THREE.Vector3();
  private rotTarget = new THREE.Euler();

  // Recoil impulse
  private recoilKickZ  = 0;   // backward kick (along local Z)
  private recoilKickY  = 0;   // upward kick
  private recoilRollR  = 0;   // small roll

  // Sway accumulator
  private swayX = 0;
  private swayY = 0;

  // Bob accumulator
  private bobPhase = 0;
  private bobAmt   = 0;

  // Reload animation
  private reloadT      = 0;   // 0→1 during reload
  private reloadActive = false;
  private reloadDur    = 2.2;

  // Sprint state
  private sprintT = 0;

  // ADS progress (mirrored from renderer)
  private adsT = 0;

  // Muzzle flash timer
  private flashTimer = 0;

  // Alive flag
  private alive = true;

  constructor(scene: THREE.Scene, weaponId: WeaponId) {
    this.cfg = WEAPON_CONFIGS[weaponId] ?? WEAPON_CONFIGS.rifle;

    // Root group — follows camera transform set in render()
    this.group = new THREE.Group();
    scene.add(this.group);

    // Weapon mesh group (child of root, so animations are local)
    this.weaponGroup = buildWeaponMesh(weaponId);
    this.weaponGroup.scale.setScalar(this.cfg.scale);
    this.group.add(this.weaponGroup);

    // Muzzle pivot — placed at muzzle tip so flash spawns correctly
    this.muzzlePivot = new THREE.Group();
    this.muzzlePivot.position.set(0, 0.006 * this.cfg.scale, -0.42 * this.cfg.scale);
    this.weaponGroup.add(this.muzzlePivot);

    // Muzzle flash (child of muzzle pivot)
    this.muzzleFlashGroup = buildMuzzleFlash();
    this.muzzlePivot.add(this.muzzleFlashGroup);

    // Start at hip position
    this.posTarget.copy(this.cfg.hipPos);
    this.rotTarget.copy(this.cfg.hipRot);
    this.group.position.copy(this.cfg.hipPos);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Call when the player fires — triggers recoil and muzzle flash. */
  onFire(flashDuration: number) {
    this.recoilKickZ  = 0.025;
    this.recoilKickY  = 0.018;
    this.recoilRollR  = (Math.random() - 0.5) * 0.06;
    this.flashTimer   = flashDuration;
    this.muzzleFlashGroup.visible = true;
    // Randomise flash scale slightly
    const s = 0.8 + Math.random() * 0.5;
    this.muzzleFlashGroup.scale.setScalar(s);
    this.muzzleFlashGroup.rotation.z = Math.random() * Math.PI;
  }

  /** Call when reload starts. dur = weapon's reloadDuration. */
  onReloadStart(dur: number) {
    this.reloadActive = true;
    this.reloadT      = 0;
    this.reloadDur    = dur;
  }

  /** Call when reload completes or is cancelled. */
  onReloadEnd() {
    this.reloadActive = false;
    this.reloadT      = 0;
  }

  /** Mirror adsProgress (0=hip, 1=ads) from the renderer each frame. */
  setAds(t: number) { this.adsT = t; }

  /** Mirror player alive state. */
  setAlive(alive: boolean) {
    this.alive = alive;
    this.group.visible = alive;
  }

  /**
   * Main per-frame update.
   * camPos/camRot: the camera's world position and rotation.
   * dt: delta time in seconds.
   * moving/sprinting/crouching: from input state.
   * reducedMotion: from settings.
   */
  update(
    camPos: THREE.Vector3,
    camRot: THREE.Euler,
    dt: number,
    moving: boolean,
    sprinting: boolean,
    crouching: boolean,
    reducedMotion = false,
  ) {
    if (!this.alive) return;

    const motionScale = reducedMotion ? 0.15 : 1.0;
    const ads = this.adsT;

    // ── 1. Muzzle flash ───────────────────────────────────────────────────
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.flashTimer <= 0 && this.muzzleFlashGroup.visible) {
      this.muzzleFlashGroup.visible = false;
    }

    // ── 2. Reload animation ───────────────────────────────────────────────
    let reloadDropY = 0;
    let reloadTiltX = 0;
    if (this.reloadActive) {
      this.reloadT = Math.min(1, this.reloadT + dt / this.reloadDur);
      // Magazine drop: sine arch — down then back up
      const arch = Math.sin(this.reloadT * Math.PI);
      reloadDropY  = arch * -0.045 * motionScale;
      reloadTiltX  = arch *  0.35  * motionScale;
      if (this.reloadT >= 1) this.reloadActive = false;
    }

    // ── 3. Recoil decay ───────────────────────────────────────────────────
    const recoilDecay = dt * 14;
    this.recoilKickZ = Math.max(0, this.recoilKickZ - recoilDecay * 0.025);
    this.recoilKickY = Math.max(0, this.recoilKickY - recoilDecay * 0.018);
    this.recoilRollR = this.recoilRollR > 0
      ? Math.max(0, this.recoilRollR - recoilDecay * 0.06)
      : Math.min(0, this.recoilRollR + recoilDecay * 0.06);

    // ── 4. Sprint tilt ────────────────────────────────────────────────────
    const sprintTarget = sprinting ? 1 : 0;
    this.sprintT = THREE.MathUtils.lerp(this.sprintT, sprintTarget, dt * 7);

    // ── 5. Movement bob ───────────────────────────────────────────────────
    const bobSpeed = sprinting ? 9 : crouching ? 5 : 7;
    if (moving && !sprinting) {
      this.bobPhase += dt * bobSpeed;
      this.bobAmt    = THREE.MathUtils.lerp(this.bobAmt, 1, dt * 8);
    } else {
      this.bobAmt    = THREE.MathUtils.lerp(this.bobAmt, 0, dt * 6);
    }

    const bobAmplitude = ads > 0.5 ? 0.0025 : 0.006;
    const bobX = Math.sin(this.bobPhase)        * bobAmplitude * this.bobAmt * motionScale;
    const bobY = Math.sin(this.bobPhase * 2)    * bobAmplitude * this.bobAmt * motionScale * 0.5;

    // ── 6. Idle sway ──────────────────────────────────────────────────────
    if (!reducedMotion) {
      const swayAmt  = ads > 0.5 ? 0.0008 : 0.003;
      const swayFreq = 0.9;
      this.swayX = Math.sin(clock.elapsed * swayFreq)       * swayAmt;
      this.swayY = Math.sin(clock.elapsed * swayFreq * 0.7) * swayAmt * 0.5;
    } else {
      this.swayX = 0;
      this.swayY = 0;
    }

    // ── 7. Compose target position ────────────────────────────────────────
    const basePos = ads > 0.5
      ? this.cfg.adsPos
      : this.cfg.hipPos;

    _v3.set(
      basePos.x + bobX + this.swayX,
      basePos.y + bobY + this.swayY + reloadDropY
        - this.recoilKickY * (1 - ads),
      basePos.z + this.recoilKickZ * 0.5,
    );
    this.posTarget.copy(_v3);

    // ── 8. Compose target rotation ────────────────────────────────────────
    const baseRot = ads > 0.5 ? this.cfg.adsRot : this.cfg.hipRot;
    this.rotTarget.set(
      baseRot.x + reloadTiltX,
      baseRot.y,
      baseRot.z
        + this.recoilRollR * motionScale
        + this.sprintT * this.cfg.sprintTilt * (1 - ads),
    );

    // ── 9. Position the root group in camera space then into world space ──
    // We manually compute the world position by rotating the local offset
    // by the camera's rotation — same pattern as the original box weapon.
    const lerpSpeed = ads > 0.5 ? 18 : 14;
    this.group.position.lerp(this.posTarget, dt * lerpSpeed);
    // Lerp rotation
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, this.rotTarget.x, dt * lerpSpeed);
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.rotTarget.y, dt * lerpSpeed);
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, this.rotTarget.z, dt * lerpSpeed);

    // Transform local offset into world space by applying camera rotation
    const worldOffset = this.group.position.clone().applyEuler(camRot);
    this.group.position.copy(camPos).add(worldOffset);

    // Match camera's base rotation then add weapon-local tilt
    this.group.rotation.x += camRot.x;
    this.group.rotation.y += camRot.y;
    this.group.rotation.z += camRot.z;
    this.group.rotation.order = 'YXZ';

    // Apply recoil kick as a forward/back Z offset in view space
    _v3.set(0, 0, this.recoilKickZ).applyEuler(camRot);
    this.group.position.add(_v3);
  }

  /** Switch to a different weapon. Rebuilds mesh in-place. */
  switchWeapon(id: WeaponId, _scene: THREE.Scene) {
    // Dispose old geometries (materials are cached and shared)
    this.group.remove(this.weaponGroup);
    disposeMeshes(this.weaponGroup);

    this.cfg = WEAPON_CONFIGS[id] ?? WEAPON_CONFIGS.rifle;
    this.weaponGroup = buildWeaponMesh(id);
    this.weaponGroup.scale.setScalar(this.cfg.scale);
    this.group.add(this.weaponGroup);

    // Re-attach muzzle pivot
    this.muzzlePivot = new THREE.Group();
    this.muzzlePivot.position.set(0, 0.006 * this.cfg.scale, -0.42 * this.cfg.scale);
    this.weaponGroup.add(this.muzzlePivot);
    this.muzzlePivot.add(this.muzzleFlashGroup);

    // Reset animation state
    this.recoilKickZ = 0; this.recoilKickY = 0; this.recoilRollR = 0;
    this.reloadActive = false; this.reloadT = 0;
    this.sprintT = 0; this.adsT = 0;
  }

  /** Dispose all owned resources. Call when the renderer is destroyed. */
  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    disposeMeshes(this.group);
    // Clear shared geometry/material caches
    GEO_CACHE.forEach(g => g.dispose());
    GEO_CACHE.clear();
    MAT_CACHE.forEach(m => m.dispose());
    MAT_CACHE.clear();
  }
}

// ── Typed mesh disposal helper (avoids unsafe-any on traverse) ────────────────

function disposeMeshes(root: THREE.Object3D) {
  root.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mesh = obj as THREE.Mesh;
    (mesh.geometry).dispose();
    const mats = Array.isArray(mesh.material)
      ? (mesh.material)
      : [mesh.material];
    mats.forEach((m: THREE.Material) => m.dispose());
  });
}


