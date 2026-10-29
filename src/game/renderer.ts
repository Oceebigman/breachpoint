// BREACHPOINT — Three.js renderer, FPS scene, input, player controller

import * as THREE from 'three';
import { MapDef, resolveCollision, raycastAABB } from './world';
import { WeaponState, WeaponId, createWeaponState, tickWeapon, tryFire, tryReload, calcDamage } from './weapons';
import { Bot, BotDifficulty, createBot, tickBot } from './bots';
import {
  MatchState, MatchConfig, DEFAULT_CONFIG, createMatchState,
  tickMode, recordKill, playerInteractObjective, playerDefuse,
  PlayerStats, emptyStats,
} from './modes';
import { clock, bus, GamePhase } from './core';
import { buildIrongateMap } from './world';
import { WeaponViewModel } from './weaponView';
import {
  resumeAudio, updateListener, setMasterVolume, disposeAudio,
  playGunshot, playBulletImpact, playHitMarker, playKillConfirm,
  playDamageReceived, playPlayerDeath, playEmptyMag,
  playReloadStart, playReloadComplete,
  playFootstep, playJump, playLand,
  playObjectiveBeep, playObjectiveArmed, playObjectiveDefused, playExplosion,
  playFuseWarning, playRoundStart, playRoundEnd, playMatchEnd,
} from './audio';

// ---------- Types ----------

export interface PlayerEntity {
  id: string;
  team: 0 | 1;
  position: THREE.Vector3;
  alive: boolean;
  health: number;
  weapon: WeaponState;
  yaw: number;
  pitch: number;
  stats: PlayerStats;
}

export interface GameSnapshot {
  phase: GamePhase;
  matchState: MatchState;
  player: PlayerEntity;
  bots: Bot[];
  crosshairHit: boolean;
  muzzleFlash: boolean;
  interactProgress: number; // 0-1 for E-hold
  nearObjectiveSite: string | null;
}

// ---------- Constants ----------

const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.35;
const PLAYER_EYE_Y = 1.6;
const GRAVITY = 18;
const JUMP_VEL = 6;
const BASE_SPEED = 5.5;
const SPRINT_SPEED = 9;
const CROUCH_SPEED = 3;
const MOUSE_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.05;
const ADS_FOV = 50;
const NORMAL_FOV = 75;

// ---------- Input state ----------

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  ads: boolean;
  reload: boolean;
  interact: boolean;
  scoreboard: boolean;
  pause: boolean;
  mouseDx: number;
  mouseDy: number;
}

export function emptyInput(): InputState {
  return {
    forward: false, back: false, left: false, right: false,
    sprint: false, crouch: false, jump: false, fire: false,
    ads: false, reload: false, interact: false, scoreboard: false,
    pause: false, mouseDx: 0, mouseDy: 0,
  };
}

// ---------- Renderer class ----------

export class BPRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private animId = 0;

  // Map
  private map: MapDef;
  private wallMeshes: THREE.Mesh[] = [];

  // Player
  private playerPos = new THREE.Vector3(-48, 0.9, 0);
  private playerVelY = 0;
  private playerYaw = 0;
  private playerPitch = 0;
  private playerHealth = 100;
  private playerAlive = true;
  private playerWeapon: WeaponState;
  private playerTeam: 0 | 1 = 0;
  private isCrouching = false;
  private isGrounded = true;
  private adsProgress = 0; // 0=hip, 1=ads

  // Bots
  private bots: Bot[] = [];
  private botMeshes: Map<string, THREE.Mesh> = new Map();

  // Match
  private matchState: MatchState;
  private matchConfig: MatchConfig;

  // Input
  input: InputState = emptyInput();
  private pointerLocked = false;
  private rightDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Interaction
  private interactHoldTimer = 0;
  private nearObjectiveSite: string | null = null;

  // Effects
  private muzzleFlashTimer = 0;
  private crosshairHit = false;
  private crosshairHitTimer = 0;
  private recoilPitchOffset = 0;

  // Weapon view model (procedural multi-part rifle)
  private weaponViewModel!: WeaponViewModel;

  // Track movement for view-model animation
  private _moveVec = new THREE.Vector3();

  // Objective markers
  private objectiveMarkers: THREE.Mesh[] = [];

  // Snapshot callback
  onSnapshot: ((snap: GameSnapshot) => void) | null = null;

  // Death/respawn
  private respawnTimer = 0;
  private RESPAWN_DELAY = 4;

  // Audio state tracking
  private prevReloading = false;
  private prevReloadTimeLeft = 0;
  private prevGrounded = true;
  private fuseWarnTimer = 0;
  private prevPhase: string = '';

  private playerStats: PlayerStats = emptyStats();
  private playerName = 'AGENT';

  constructor(canvas: HTMLCanvasElement, botDifficulty: BotDifficulty = 'normal', botCount = 4, playerTeam: 0 | 1 = 0, weaponId: WeaponId = 'rifle') {
    this.canvas = canvas;
    this.playerTeam = playerTeam;
    this.map = buildIrongateMap();
    this.matchConfig = { ...DEFAULT_CONFIG, teamSize: Math.ceil(botCount / 2) + 1 };
    this.matchState = createMatchState(this.matchConfig, this.map.objectives.map(o => o.id));
    this.playerWeapon = createWeaponState(weaponId);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false; // perf

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1e2a);
    this.scene.fog = new THREE.Fog(0x1a1e2a, 40, 90);

    // Camera
    this.camera = new THREE.PerspectiveCamera(NORMAL_FOV, canvas.clientWidth / canvas.clientHeight, 0.05, 200);
    this.scene.add(this.camera);

    this.buildScene();
    this.weaponViewModel = new WeaponViewModel(this.scene, weaponId);
    this.spawnBots(botDifficulty, botCount);
    this.setupInput();
    this.spawnPlayer();
  }

  private buildScene() {
    // Ambient + directional lights
    const ambient = new THREE.AmbientLight(0xb0c0d0, 0.6);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    this.scene.add(dir);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 80),
      new THREE.MeshLambertMaterial({ color: 0x3a3f4a }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 80),
      new THREE.MeshLambertMaterial({ color: 0x252830 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);

    // Build walls from colliders
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x4a5060 });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0x2e3340 });

    for (const aabb of this.map.colliders) {
      const w = aabb.max.x - aabb.min.x;
      const h = aabb.max.y - aabb.min.y;
      const d = aabb.max.z - aabb.min.z;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        w > 20 ? wallMat : accentMat, // outer walls vs interior
      );
      mesh.position.set(
        (aabb.min.x + aabb.max.x) / 2,
        (aabb.min.y + aabb.max.y) / 2,
        (aabb.min.z + aabb.max.z) / 2,
      );
      this.scene.add(mesh);
      this.wallMeshes.push(mesh);
    }

    // Objective site markers
    for (const obj of this.map.objectives) {
      const markerGeo = new THREE.CylinderGeometry(obj.radius, obj.radius, 0.05, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.5 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(obj.position).setY(0.03);
      this.scene.add(marker);
      this.objectiveMarkers.push(marker);
    }

    // Weapon view model — built after scene lights are present
    // (constructed in constructor after buildScene, see below)
  }

  private spawnBots(difficulty: BotDifficulty, count: number) {
    const spawnsByTeam = this.map.spawns.reduce((acc, s) => {
      acc[s.team] = acc[s.team] || [];
      acc[s.team].push(s);
      return acc;
    }, {} as Record<number, typeof this.map.spawns>);

    let created = 0;
    for (let t = 0; t < 2 && created < count; t++) {
      const enemyTeam = (1 - this.playerTeam) as 0 | 1;
      const botTeam = (created % 2 === 0 ? enemyTeam : this.playerTeam);
      const spawns = spawnsByTeam[botTeam] || [];
      const spawnIdx = created % Math.max(1, spawns.length);
      const spawn = spawns[spawnIdx];
      if (!spawn) { created++; continue; }

      const weapons: WeaponId[] = ['rifle', 'smg', 'pistol', 'heavy', 'precision'];
      const wId = weapons[created % weapons.length];
      const bot = createBot(`bot_${created}`, botTeam, spawn.position, spawn.yaw, difficulty, wId);
      this.bots.push(bot);

      // Bot mesh
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 1.1, 4, 8),
        new THREE.MeshLambertMaterial({ color: botTeam === 0 ? 0x3b82f6 : 0xef4444 }),
      );
      mesh.position.copy(bot.position);
      this.scene.add(mesh);
      this.botMeshes.set(bot.id, mesh);
      created++;
    }
  }

  private spawnPlayer() {
    const spawn = this.map.spawns.find(s => s.team === this.playerTeam);
    if (spawn) {
      this.playerPos = spawn.position.clone();
      this.playerYaw = spawn.yaw;
    }
    this.playerHealth = 100;
    this.playerAlive = true;
    this.playerWeapon = createWeaponState(this.playerWeapon.def.id);
  }

  private setupInput() {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.input.forward = down; break;
        case 'KeyS': case 'ArrowDown':  this.input.back = down; break;
        case 'KeyA': case 'ArrowLeft':  this.input.left = down; break;
        case 'KeyD': case 'ArrowRight': this.input.right = down; break;
        case 'ShiftLeft': case 'ShiftRight': this.input.sprint = down; break;
        case 'ControlLeft': case 'KeyC': this.input.crouch = down; break;
        case 'Space': this.input.jump = down; e.preventDefault(); break;
        case 'KeyR': this.input.reload = down; break;
        case 'KeyE': this.input.interact = down; break;
        case 'Tab': this.input.scoreboard = down; e.preventDefault(); break;
      }
    };
    document.addEventListener('keydown', e => onKey(e, true));
    document.addEventListener('keyup', e => onKey(e, false));

    document.addEventListener('mousedown', e => {
      if (e.button === 0) this.input.fire = true;
      if (e.button === 2) this.input.ads = true;
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.input.fire = false;
      if (e.button === 2) this.input.ads = false;
    });
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Mouse move: pointer lock (desktop/deployed) OR right-drag fallback (sandboxed iframe)
    document.addEventListener('mousemove', e => {
      if (this.pointerLocked) {
        this.input.mouseDx += e.movementX;
        this.input.mouseDy += e.movementY;
      } else if (this.rightDragging) {
        this.input.mouseDx += e.movementX || (e.clientX - this.lastMouseX);
        this.input.mouseDy += e.movementY || (e.clientY - this.lastMouseY);
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    // Right-drag to look (fallback when pointer lock is blocked by sandbox)
    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 2) {
        this.rightDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 2) this.rightDragging = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) bus.emit('pointer_unlock');
    });

    // Try pointer lock on canvas click; silently ignore sandbox SecurityError
    this.canvas.addEventListener('click', () => {
      if (!this.pointerLocked) {
        void this.canvas.requestPointerLock().catch(() => {
          // Sandboxed iframe — pointer lock blocked; right-drag fallback is active
        });
      }
    });

    // Mark as "playing" immediately so the game runs without waiting for lock
    this.pointerLocked = true;
    bus.emit('playing');
  }

  requestPointerLock() {
    void this.canvas.requestPointerLock().catch(() => {
      // Sandboxed iframe — pointer lock blocked; right-drag fallback is active
    });
  }

  /** Set master volume 0–1; wired from SettingsScreen */
  setVolume(v: number) {
    setMasterVolume(v);
  }

  start() {
    resumeAudio();
    clock.reset();
    const loop = (ts: number) => {
      clock.tick(ts);
      this.update(clock.delta);
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.animId);
    this.weaponViewModel.dispose(this.scene);
    this.renderer.dispose();
    disposeAudio();
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private update(dt: number) {
    const ms = this.matchState;

    // Tick match mode
    const aliveCount: [number, number] = [0, 0];
    if (this.playerAlive) aliveCount[this.playerTeam]++;
    for (const b of this.bots) if (b.alive) aliveCount[b.team]++;

    const modeResult = tickMode({ ms, dt, aliveCount });
    this.matchState = modeResult.ms;

    // Handle mode events
    for (const ev of modeResult.events) {
      if (ev.type === 'round_start' || ev.type === 'round_end') {
        this.respawnAll();
      }
      if (ev.type === 'round_start') playRoundStart();
      if (ev.type === 'round_end') {
        const payload = ev.payload as { outcome: string } | undefined;
        playRoundEnd(payload?.outcome === 'attackers_win');
      }
      if (ev.type === 'match_end') {
        const winner = ev.payload as 0 | 1;
        playMatchEnd(winner === this.playerTeam);
      }
      if (ev.type === 'objective_armed') playObjectiveArmed();
      if (ev.type === 'objective_defused') playObjectiveDefused();
      if (ev.type === 'objective_detonated') {
        const obj = this.map.objectives[0];
        playExplosion(obj ? { x: obj.position.x, y: obj.position.y, z: obj.position.z } : null);
      }
      bus.emit(ev.type, ev.payload);
    }

    // Update 3D audio listener position each frame
    updateListener(this.playerPos.x, this.playerPos.y, this.playerPos.z, this.playerYaw);

    // Fuse warning beep when bomb armed and timer < 10s
    const armedObj = this.matchState.objectives.find(o => o.phase === 'armed' || o.phase === 'defusing');
    if (armedObj && armedObj.armedTimer < 10) {
      this.fuseWarnTimer -= dt;
      if (this.fuseWarnTimer <= 0) {
        playFuseWarning();
        this.fuseWarnTimer = Math.max(0.15, armedObj.armedTimer / 10); // speed up as timer drops
      }
    } else {
      this.fuseWarnTimer = 0;
    }

    // Respawn
    if (!this.playerAlive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.spawnPlayer();
    }

    if (this.matchState.phase !== 'active') {
      this.emitSnapshot();
      return;
    }

    // --- Player input ---
    if (this.playerAlive) {
      this.tickPlayer(dt);
    }

    // --- Bots ---
    const allEntities = [
      { id: 'player', team: this.playerTeam, position: this.playerPos.clone(), alive: this.playerAlive },
      ...this.bots.map(b => ({ id: b.id, team: b.team, position: b.position.clone(), alive: b.alive })),
    ];

    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (!b.alive) continue;
      const objectivePos = this.map.objectives[0]?.position ?? null;
      const result = tickBot({
        bot: b,
        dt,
        map: this.map,
        entities: allEntities,
        objectivePos,
        isAttacker: b.team === 0,
      });
      this.bots[i] = result.bot;

      if (result.shotFired && result.hitId) {
        // Spatial bot gunshot sound
        playGunshot(b.weapon.def.id, { x: b.position.x, y: b.position.y, z: b.position.z });

        if (result.hitId === 'player' && this.playerAlive) {
          this.playerHealth = Math.max(0, this.playerHealth - result.hitDamage);
          playDamageReceived();
          bus.emit('player_hit', { damage: result.hitDamage, health: this.playerHealth });
          if (this.playerHealth <= 0) {
            this.playerAlive = false;
            this.respawnTimer = this.RESPAWN_DELAY;
            playPlayerDeath();
            this.matchState = recordKill(this.matchState, b.id, 'Bot',
              'player', this.playerName, b.weapon.def.name);
          }
        } else {
          // Bot hit another bot
          const hitBot = this.bots.find(x => x.id === result.hitId);
          if (hitBot && hitBot.alive) {
            hitBot.health = Math.max(0, hitBot.health - result.hitDamage);
            if (hitBot.health <= 0) {
              hitBot.alive = false;
              this.matchState = recordKill(this.matchState, b.id, 'Bot', hitBot.id, 'Bot', b.weapon.def.name);
            }
          }
        }
      }

      // Update mesh
      const mesh = this.botMeshes.get(b.id);
      if (mesh) {
        mesh.visible = b.alive;
        mesh.position.copy(b.position).setY(b.position.y + 0.8);
        mesh.rotation.y = b.yaw;
      }
    }

    // Update objective marker pulse
    for (let i = 0; i < this.objectiveMarkers.length; i++) {
      const obj = this.matchState.objectives[i];
      const mat = this.objectiveMarkers[i].material as THREE.MeshBasicMaterial;
      if (obj.phase === 'armed' || obj.phase === 'defusing') {
        mat.color.set(0xef4444);
        mat.opacity = 0.6 + Math.sin(clock.elapsed * 8) * 0.2;
      } else if (obj.phase === 'planting') {
        mat.color.set(0xf59e0b);
        mat.opacity = 0.7;
      } else {
        mat.color.set(0xf59e0b);
        mat.opacity = 0.4;
      }
    }

    this.emitSnapshot();
  }

  private tickPlayer(dt: number) {
    const inp = this.input;

    // Mouse look
    const sens = MOUSE_SENSITIVITY;
    this.playerYaw -= inp.mouseDx * sens;
    this.playerPitch -= inp.mouseDy * sens;
    this.playerPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.playerPitch));
    inp.mouseDx = 0;
    inp.mouseDy = 0;

    // ADS
    const targetAds = inp.ads ? 1 : 0;
    this.adsProgress = THREE.MathUtils.lerp(this.adsProgress, targetAds, dt * 8);

    // Movement
    this.isCrouching = inp.crouch;
    const speed = this.isCrouching ? CROUCH_SPEED : inp.sprint ? SPRINT_SPEED : BASE_SPEED;
    const move = new THREE.Vector3();
    if (inp.forward) move.z -= 1;
    if (inp.back) move.z += 1;
    if (inp.left) move.x -= 1;
    if (inp.right) move.x += 1;
    if (move.lengthSq() > 0) move.normalize();

    // Rotate by yaw
    move.applyEuler(new THREE.Euler(0, this.playerYaw, 0));
    move.multiplyScalar(speed * dt);

    // Gravity + jump/land audio
    const wasGrounded = this.prevGrounded;
    if (!this.isGrounded) this.playerVelY -= GRAVITY * dt;
    else if (inp.jump) {
      this.playerVelY = JUMP_VEL;
      this.isGrounded = false;
      playJump();
    }
    else this.playerVelY = 0;

    move.y += this.playerVelY * dt;

    const next = this.playerPos.clone().add(move);
    const playerH = this.isCrouching ? 1.1 : PLAYER_HEIGHT;
    const resolved = resolveCollision(next, PLAYER_RADIUS, playerH, this.map.colliders);

    // Ground check
    this.isGrounded = resolved.y <= 0.91;
    if (this.isGrounded) {
      if (!wasGrounded) playLand(Math.abs(this.playerVelY) > 6); // land sound on touchdown
      resolved.y = 0.9;
      this.playerVelY = 0;
    }
    this.prevGrounded = this.isGrounded;

    this.playerPos.copy(resolved);

    // Footsteps — only when moving on ground
    const isMovingNow = move.lengthSq() > 0.0001;
    if (isMovingNow && this.isGrounded) {
      playFootstep(inp.sprint, inp.crouch);
    }

    // Cache movement vector for view-model animation in render()
    this._moveVec.copy(move);

    // Weapon tick — capture pre-tick reload state for reload-complete detection
    this.prevReloading = this.playerWeapon.reloading;
    this.prevReloadTimeLeft = this.playerWeapon.reloadTimeLeft;
    this.playerWeapon = tickWeapon(this.playerWeapon, dt);

    // Reload-complete detection (was reloading, now not reloading)
    if (this.prevReloading && !this.playerWeapon.reloading) {
      playReloadComplete();
      this.weaponViewModel.onReloadEnd();
    }

    // Reload start
    if (inp.reload) {
      const before = this.playerWeapon.reloading;
      this.playerWeapon = tryReload(this.playerWeapon);
      if (!before && this.playerWeapon.reloading) {
        playReloadStart();
        this.weaponViewModel.onReloadStart(this.playerWeapon.def.reloadDuration);
      }
    }

    // Fire
    if (inp.fire && (this.playerWeapon.def.automatic || !this._lastFire)) {
      const isMoving = move.lengthSq() > 0.0001;
      // Empty mag click
      if (this.playerWeapon.ammoInMag <= 0 && !this.playerWeapon.reloading) {
        if (!this._lastFire) playEmptyMag();
      }
      const result = tryFire(this.playerWeapon, this.adsProgress > 0.5, isMoving);
      this.playerWeapon = result.ws;
      if (result.fired) {
        // Player gunshot — no spatial (it's the player's own weapon)
        playGunshot(this.playerWeapon.def.id, null);

        this.weaponViewModel.onFire(this.playerWeapon.def.muzzleFlashDuration);
        this.muzzleFlashTimer = this.playerWeapon.def.muzzleFlashDuration;
        this.recoilPitchOffset += this.playerWeapon.def.recoilPitch * (Math.PI / 180) * 0.5;
        // Apply recoil to pitch
        this.playerPitch += this.recoilPitchOffset;
        this.playerPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.playerPitch));
        this.recoilPitchOffset = 0;

        // Raycast
        const eyePos = this.playerPos.clone().add(new THREE.Vector3(0, PLAYER_EYE_Y, 0));
        const fireDir = new THREE.Vector3(
          Math.sin(this.playerYaw) * Math.cos(this.playerPitch),
          Math.sin(this.playerPitch),
          Math.cos(this.playerYaw) * Math.cos(this.playerPitch),
        ).normalize();

        this.playerShoot(eyePos, fireDir, result.spread);
      }
    }
    this._lastFire = inp.fire;

    // Auto-reload when empty
    if (this.playerWeapon.ammoInMag === 0 && !this.playerWeapon.reloading) {
      const before = this.playerWeapon.reloading;
      this.playerWeapon = tryReload(this.playerWeapon);
      if (!before && this.playerWeapon.reloading) {
        playReloadStart();
        this.weaponViewModel.onReloadStart(this.playerWeapon.def.reloadDuration);
      }
    }

    // Recoil pitch decay
    this.playerPitch -= this.playerPitch * dt * 3;

    // ADS FOV
    this.camera.fov = THREE.MathUtils.lerp(NORMAL_FOV, ADS_FOV, this.adsProgress);
    this.camera.updateProjectionMatrix();

    // Muzzle flash
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    this.crosshairHitTimer = Math.max(0, this.crosshairHitTimer - dt);
    this.crosshairHit = this.crosshairHitTimer > 0;

    // Interact / objective
    this.tickInteract(dt);
  }

  private _lastFire = false;

  private playerShoot(eyePos: THREE.Vector3, dir: THREE.Vector3, spreadDeg: number) {
    const spreadRad = (spreadDeg * Math.PI) / 180;
    const fireDir = dir.clone();
    fireDir.x += (Math.random() - 0.5) * spreadRad * 2;
    fireDir.y += (Math.random() - 0.5) * spreadRad * 2;
    fireDir.z += (Math.random() - 0.5) * spreadRad * 2;
    fireDir.normalize();

    // Wall distance
    let wallDist = Infinity;
    for (const c of this.map.colliders) {
      const t = raycastAABB(eyePos, fireDir, c);
      if (t < wallDist) wallDist = t;
    }

    // Hit bots
    let bestDist = wallDist;
    let hitBot: Bot | null = null;
    for (const b of this.bots) {
      if (!b.alive || b.team === this.playerTeam) continue;
      const toB = b.position.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(eyePos);
      const proj = toB.dot(fireDir);
      if (proj <= 0 || proj > bestDist) continue;
      const closest = eyePos.clone().addScaledVector(fireDir, proj);
      const dist2 = closest.distanceToSquared(b.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
      if (dist2 < 0.6 * 0.6) {
        bestDist = proj;
        hitBot = b;
      }
    }

    if (hitBot) {
      const dmg = calcDamage(this.playerWeapon.def, bestDist);
      hitBot.health = Math.max(0, hitBot.health - dmg);
      this.crosshairHit = true;
      this.crosshairHitTimer = 0.15;
      playHitMarker();
      bus.emit('hit_marker', { damage: dmg });
      if (hitBot.health <= 0) {
        hitBot.alive = false;
        playKillConfirm();
        this.matchState = recordKill(
          this.matchState, 'player', this.playerName, hitBot.id, 'Bot', this.playerWeapon.def.name,
        );
        this.playerStats = { ...this.playerStats, kills: this.playerStats.kills + 1 };
        bus.emit('kill', { victimId: hitBot.id, weapon: this.playerWeapon.def.name });
      }
    } else {
      // Bullet hit a wall — spatial impact at the ray's furthest wall point
      if (wallDist < Infinity) {
        const wallHitPos = eyePos.clone().addScaledVector(fireDir, wallDist);
        playBulletImpact({ x: wallHitPos.x, y: wallHitPos.y, z: wallHitPos.z });
      }
    }
  }

  private tickInteract(dt: number) {
    // Find nearest objective
    this.nearObjectiveSite = null;
    let nearestDist = 5;
    for (const obj of this.map.objectives) {
      const dist = this.playerPos.distanceTo(obj.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        this.nearObjectiveSite = obj.id;
      }
    }

    if (this.nearObjectiveSite && this.input.interact) {
      this.interactHoldTimer += dt;
      const objState = this.matchState.objectives.find(o => o.siteId === this.nearObjectiveSite);
      if (objState) {
        // Beep during planting/defusing
        const progress = objState.phase === 'planting' ? objState.progress
          : objState.phase === 'defusing' ? Math.max(0, -objState.progress) : 0;
        if (objState.phase === 'planting' || objState.phase === 'defusing') {
          playObjectiveBeep(progress);
        }
        if (this.playerTeam === 0 && (objState.phase === 'idle' || objState.phase === 'planting')) {
          this.matchState = playerInteractObjective(
            this.matchState, this.nearObjectiveSite, 'player', this.playerTeam, true, dt,
          );
        } else if (this.playerTeam === 1 && (objState.phase === 'armed' || objState.phase === 'defusing')) {
          this.matchState = playerDefuse(
            this.matchState, this.nearObjectiveSite, 'player', true, dt,
          );
        }
      }
    } else {
      this.interactHoldTimer = 0;
      if (this.nearObjectiveSite) {
        const objState = this.matchState.objectives.find(o => o.siteId === this.nearObjectiveSite);
        if (objState?.phase === 'planting') {
          this.matchState = playerInteractObjective(
            this.matchState, this.nearObjectiveSite, 'player', this.playerTeam, false, dt,
          );
        } else if (objState?.phase === 'defusing') {
          this.matchState = playerDefuse(
            this.matchState, this.nearObjectiveSite, 'player', false, dt,
          );
        }
      }
    }
  }

  private respawnAll() {
    this.spawnPlayer();
    const spawnsByTeam = this.map.spawns.reduce((acc, s) => {
      acc[s.team] = acc[s.team] || [];
      acc[s.team].push(s);
      return acc;
    }, {} as Record<number, typeof this.map.spawns>);

    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const spawns = spawnsByTeam[bot.team] || [];
      const spawn = spawns[i % Math.max(1, spawns.length)];
      if (spawn) {
        this.bots[i] = { ...bot, alive: true, health: 100, position: spawn.position.clone(), state: 'patrol' };
      }
    }
  }

  private render() {
    // Position camera
    const eyeY = (this.isCrouching ? 1.0 : PLAYER_EYE_Y) + (this.playerAlive ? 0 : -0.5);
    this.camera.position.copy(this.playerPos).setY(this.playerPos.y + eyeY);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.playerYaw;
    this.camera.rotation.x = this.playerPitch;
    this.camera.rotation.z = 0;

    // Update weapon view model
    const moving   = this._moveVec.lengthSq() > 0.0001;
    const sprinting = this.input.sprint && moving;
    this.weaponViewModel.setAlive(this.playerAlive);
    this.weaponViewModel.setAds(this.adsProgress);
    this.weaponViewModel.update(
      this.camera.position,
      this.camera.rotation,
      clock.delta,
      moving,
      sprinting,
      this.isCrouching,
    );

    this.renderer.render(this.scene, this.camera);
  }

  private emitSnapshot() {
    if (!this.onSnapshot) return;
    const interactProgress = (() => {
      if (!this.nearObjectiveSite) return 0;
      const obj = this.matchState.objectives.find(o => o.siteId === this.nearObjectiveSite);
      if (!obj) return 0;
      if (obj.phase === 'planting') return obj.progress;
      if (obj.phase === 'defusing') return Math.max(0, -obj.progress);
      return 0;
    })();

    this.onSnapshot({
      phase: this.matchState.phase === 'active' ? 'active'
        : this.matchState.phase === 'warmup' ? 'warmup'
        : this.matchState.phase === 'round_end' ? 'round_result'
        : this.matchState.phase === 'match_end' ? 'match_result'
        : 'active',
      matchState: this.matchState,
      player: {
        id: 'player',
        team: this.playerTeam,
        position: this.playerPos.clone(),
        alive: this.playerAlive,
        health: this.playerHealth,
        weapon: this.playerWeapon,
        yaw: this.playerYaw,
        pitch: this.playerPitch,
        stats: this.playerStats,
      },
      bots: [...this.bots],
      crosshairHit: this.crosshairHit,
      muzzleFlash: this.muzzleFlashTimer > 0,
      interactProgress,
      nearObjectiveSite: this.nearObjectiveSite,
    });
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: (this.matchState.phase as string) === 'active' ? 'active'
        : (this.matchState.phase as string) === 'warmup' ? 'warmup'
        : (this.matchState.phase as string) === 'round_end' ? 'round_result'
        : 'match_result',
      matchState: this.matchState,
      player: {
        id: 'player',
        team: this.playerTeam,
        position: this.playerPos.clone(),
        alive: this.playerAlive,
        health: this.playerHealth,
        weapon: this.playerWeapon,
        yaw: this.playerYaw,
        pitch: this.playerPitch,
        stats: this.playerStats,
      },
      bots: [...this.bots],
      crosshairHit: this.crosshairHit,
      muzzleFlash: this.muzzleFlashTimer > 0,
      interactProgress: this.interactHoldTimer,
      nearObjectiveSite: this.nearObjectiveSite,
    };
  }
}
