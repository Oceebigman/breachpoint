// BREACHPOINT — Weapons: data-driven definitions, fire/reload state machine

export type WeaponId = 'pistol' | 'smg' | 'rifle' | 'heavy' | 'precision';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;          // per bullet
  fireRate: number;        // rounds/sec
  magazineSize: number;
  reserveAmmo: number;
  reloadDuration: number;  // seconds
  spread: number;          // base degrees
  adsSpread: number;
  recoilPitch: number;     // degrees per shot
  recoilYaw: number;
  range: number;           // metres falloff start
  rangeMax: number;        // zero damage distance
  moveAccuracyPenalty: number;
  automatic: boolean;
  muzzleFlashDuration: number; // seconds
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'MX-9 Sidearm',
    damage: 28, fireRate: 4, magazineSize: 12, reserveAmmo: 36,
    reloadDuration: 1.6, spread: 2, adsSpread: 0.5, recoilPitch: 4, recoilYaw: 1,
    range: 20, rangeMax: 50, moveAccuracyPenalty: 1.5, automatic: false,
    muzzleFlashDuration: 0.05,
  },
  smg: {
    id: 'smg', name: 'VX-4 SMG',
    damage: 18, fireRate: 10, magazineSize: 25, reserveAmmo: 75,
    reloadDuration: 1.8, spread: 3, adsSpread: 1, recoilPitch: 3, recoilYaw: 1.5,
    range: 25, rangeMax: 60, moveAccuracyPenalty: 0.5, automatic: true,
    muzzleFlashDuration: 0.05,
  },
  rifle: {
    id: 'rifle', name: 'AR-7 Assault',
    damage: 26, fireRate: 7, magazineSize: 30, reserveAmmo: 90,
    reloadDuration: 2.2, spread: 1.5, adsSpread: 0.4, recoilPitch: 3.5, recoilYaw: 0.8,
    range: 40, rangeMax: 100, moveAccuracyPenalty: 1, automatic: true,
    muzzleFlashDuration: 0.05,
  },
  heavy: {
    id: 'heavy', name: 'LMG-12 Heavy',
    damage: 30, fireRate: 8, magazineSize: 50, reserveAmmo: 150,
    reloadDuration: 3.5, spread: 2.5, adsSpread: 0.8, recoilPitch: 4, recoilYaw: 2,
    range: 35, rangeMax: 90, moveAccuracyPenalty: 2, automatic: true,
    muzzleFlashDuration: 0.06,
  },
  precision: {
    id: 'precision', name: 'SR-1 Precision',
    damage: 80, fireRate: 1, magazineSize: 5, reserveAmmo: 20,
    reloadDuration: 2.8, spread: 0.2, adsSpread: 0.05, recoilPitch: 8, recoilYaw: 0.2,
    range: 80, rangeMax: 300, moveAccuracyPenalty: 3, automatic: false,
    muzzleFlashDuration: 0.08,
  },
};

export interface WeaponState {
  def: WeaponDef;
  ammoInMag: number;
  reserveAmmo: number;
  reloading: boolean;
  reloadTimeLeft: number;
  fireCooldown: number;
  muzzleFlashTimer: number;
  recoilPitchAccum: number;
  recoilYawAccum: number;
}

export function createWeaponState(id: WeaponId): WeaponState {
  const def = WEAPON_DEFS[id];
  return {
    def,
    ammoInMag: def.magazineSize,
    reserveAmmo: def.reserveAmmo,
    reloading: false,
    reloadTimeLeft: 0,
    fireCooldown: 0,
    muzzleFlashTimer: 0,
    recoilPitchAccum: 0,
    recoilYawAccum: 0,
  };
}

export function tickWeapon(ws: WeaponState, dt: number): WeaponState {
  let { reloading, reloadTimeLeft, fireCooldown, muzzleFlashTimer, recoilPitchAccum, recoilYawAccum } = ws;

  fireCooldown = Math.max(0, fireCooldown - dt);
  muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);

  // Decay recoil
  const recoilDecay = dt * 6;
  recoilPitchAccum = Math.max(0, recoilPitchAccum - recoilDecay);
  recoilYawAccum = recoilYawAccum > 0
    ? Math.max(0, recoilYawAccum - recoilDecay)
    : Math.min(0, recoilYawAccum + recoilDecay);

  if (reloading) {
    reloadTimeLeft -= dt;
    if (reloadTimeLeft <= 0) {
      const needed = ws.def.magazineSize - ws.ammoInMag;
      const take = Math.min(needed, ws.reserveAmmo);
      return { ...ws, reloading: false, reloadTimeLeft: 0, fireCooldown, muzzleFlashTimer,
        recoilPitchAccum, recoilYawAccum,
        ammoInMag: ws.ammoInMag + take, reserveAmmo: ws.reserveAmmo - take };
    }
    return { ...ws, reloadTimeLeft, fireCooldown, muzzleFlashTimer, recoilPitchAccum, recoilYawAccum };
  }

  return { ...ws, fireCooldown, muzzleFlashTimer, recoilPitchAccum, recoilYawAccum };
}

export function tryFire(ws: WeaponState, isAds: boolean, isMoving: boolean): {
  fired: boolean;
  spread: number;
  ws: WeaponState;
} {
  if (ws.reloading || ws.fireCooldown > 0 || ws.ammoInMag <= 0) {
    return { fired: false, spread: 0, ws };
  }

  const baseSpread = isAds ? ws.def.adsSpread : ws.def.spread;
  const movePenalty = isMoving ? ws.def.moveAccuracyPenalty : 0;
  const spread = baseSpread + movePenalty + ws.recoilPitchAccum * 0.1;

  const newRecoilPitch = ws.recoilPitchAccum + ws.def.recoilPitch;
  const newRecoilYaw = ws.recoilYawAccum + (Math.random() - 0.5) * ws.def.recoilYaw;

  return {
    fired: true,
    spread,
    ws: {
      ...ws,
      ammoInMag: ws.ammoInMag - 1,
      fireCooldown: 1 / ws.def.fireRate,
      muzzleFlashTimer: ws.def.muzzleFlashDuration,
      recoilPitchAccum: newRecoilPitch,
      recoilYawAccum: newRecoilYaw,
    },
  };
}

export function tryReload(ws: WeaponState): WeaponState {
  if (ws.reloading || ws.ammoInMag === ws.def.magazineSize || ws.reserveAmmo === 0) return ws;
  return { ...ws, reloading: true, reloadTimeLeft: ws.def.reloadDuration };
}

/** Calculate damage with range falloff */
export function calcDamage(def: WeaponDef, distance: number): number {
  if (distance <= def.range) return def.damage;
  if (distance >= def.rangeMax) return 0;
  const t = (distance - def.range) / (def.rangeMax - def.range);
  return def.damage * (1 - t);
}
