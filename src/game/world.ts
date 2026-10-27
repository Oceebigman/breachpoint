// BREACHPOINT — World: map layout, collision AABBs, spawn points, objective zones

import * as THREE from 'three';

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface SpawnPoint {
  position: THREE.Vector3;
  yaw: number; // radians, initial facing
  team: 0 | 1;
}

export interface ObjectiveZone {
  id: string;
  label: string;
  position: THREE.Vector3;
  radius: number;
  teamToPlant: 0; // team 0 attacks, team 1 defends
}

export interface MapDef {
  name: string;
  spawns: SpawnPoint[];
  objectives: ObjectiveZone[];
  colliders: AABB[];
  navNodes: THREE.Vector3[];
}

/** IRONGATE — compact industrial/security facility map
 *
 * Layout (top-down, X = east, Z = south):
 *   Attacker spawns: west  (-40, 0, 0)
 *   Defender spawns: east  (+40, 0, 0)
 *   Objective A:     central hub  (0, 0, 0)
 *   Objective B:     south wing   (0, 0, 20)
 *
 *   Two main corridors (north & south lanes), a central courtyard,
 *   a raised catwalk flank on the north side.
 */
export function buildIrongateMap(): MapDef {
  const colliders: AABB[] = [
    // Outer walls
    box(-55, 0, -35, 55, 5, -33),  // north wall
    box(-55, 0,  33, 55, 5,  35),  // south wall
    box(-55, 0, -35, -53, 5, 35),  // west wall
    box( 53, 0, -35,  55, 5, 35),  // east wall

    // Central block / hub
    box(-6, 0, -6, 6, 4, 6),

    // North lane dividers
    box(-30, 0, -20, -20, 3, -18),
    box( 20, 0, -20,  30, 3, -18),

    // South lane dividers
    box(-30, 0, 18, -20, 3, 20),
    box( 20, 0, 18,  30, 3, 20),

    // Catwalk pillars (north side)
    box(-10, 0, -30, -8, 6, -28),
    box(  8, 0, -30, 10, 6, -28),

    // Attacker side cover
    box(-45, 0, -10, -40, 2, 10),
    box(-35, 0,  -3, -30, 2,  3),

    // Defender side cover
    box(40, 0, -10, 45, 2, 10),
    box(30, 0,  -3, 35, 2,  3),

    // Objective B room walls
    box(-12, 0, 14, 12, 4, 16),
    box(-12, 0, 24, 12, 4, 26),
    box(-12, 0, 16, -10, 4, 24),
    box( 10, 0, 16,  12, 4, 24),

    // Side rooms (flanks)
    box(-55, 0, -15, -40, 3, -12),
    box(-55, 0,  12, -40, 3, 15),
    box( 40, 0, -15,  55, 3, -12),
    box( 40, 0,  12,  55, 3, 15),
  ];

  const spawns: SpawnPoint[] = [
    // Team 0 = Attackers (west)
    { position: new THREE.Vector3(-48, 0.9, -6), yaw: 0,    team: 0 },
    { position: new THREE.Vector3(-48, 0.9,  0), yaw: 0,    team: 0 },
    { position: new THREE.Vector3(-48, 0.9,  6), yaw: 0,    team: 0 },
    { position: new THREE.Vector3(-48, 0.9, -12), yaw: 0.3, team: 0 },
    { position: new THREE.Vector3(-48, 0.9,  12), yaw: -0.3, team: 0 },

    // Team 1 = Defenders (east)
    { position: new THREE.Vector3(48, 0.9, -6),  yaw: Math.PI, team: 1 },
    { position: new THREE.Vector3(48, 0.9,  0),  yaw: Math.PI, team: 1 },
    { position: new THREE.Vector3(48, 0.9,  6),  yaw: Math.PI, team: 1 },
    { position: new THREE.Vector3(48, 0.9, -12), yaw: Math.PI + 0.3, team: 1 },
    { position: new THREE.Vector3(48, 0.9,  12), yaw: Math.PI - 0.3, team: 1 },
  ];

  const objectives: ObjectiveZone[] = [
    { id: 'A', label: 'Site A — Hub', position: new THREE.Vector3(0, 0, 0),   radius: 4, teamToPlant: 0 },
    { id: 'B', label: 'Site B — Wing', position: new THREE.Vector3(0, 0, 20), radius: 4, teamToPlant: 0 },
  ];

  // Nav nodes: simple grid of walkable points for bot pathfinding
  const navNodes: THREE.Vector3[] = [];
  for (let x = -48; x <= 48; x += 8) {
    for (let z = -28; z <= 28; z += 8) {
      const p = new THREE.Vector3(x, 0.9, z);
      if (!collidesPoint(p, colliders)) navNodes.push(p);
    }
  }

  return { name: 'IRONGATE', spawns, objectives, colliders, navNodes };
}

function box(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): AABB {
  return {
    min: new THREE.Vector3(Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2)),
    max: new THREE.Vector3(Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2)),
  };
}

export function collidesAABB(aabb: AABB, pos: THREE.Vector3, radius: number, height: number): boolean {
  const closest = new THREE.Vector3(
    Math.max(aabb.min.x, Math.min(pos.x, aabb.max.x)),
    Math.max(aabb.min.y, Math.min(pos.y, aabb.max.y)),
    Math.max(aabb.min.z, Math.min(pos.z, aabb.max.z)),
  );
  const dx = pos.x - closest.x;
  const dz = pos.z - closest.z;
  const horizontalSq = dx * dx + dz * dz;
  if (horizontalSq > radius * radius) return false;
  // vertical check
  if (pos.y + height < aabb.min.y || pos.y > aabb.max.y) return false;
  return true;
}

export function collidesPoint(p: THREE.Vector3, colliders: AABB[]): boolean {
  return colliders.some(c =>
    p.x >= c.min.x && p.x <= c.max.x &&
    p.y >= c.min.y && p.y <= c.max.y &&
    p.z >= c.min.z && p.z <= c.max.z
  );
}

/** Resolve a capsule push-out against all static colliders */
export function resolveCollision(
  pos: THREE.Vector3,
  radius: number,
  height: number,
  colliders: AABB[]
): THREE.Vector3 {
  const out = pos.clone();
  for (const aabb of colliders) {
    if (!collidesAABB(aabb, out, radius, height)) continue;
    // Push out on the shallowest axis (horizontal only for simplicity)
    const cx = (aabb.min.x + aabb.max.x) / 2;
    const cz = (aabb.min.z + aabb.max.z) / 2;
    const hw = (aabb.max.x - aabb.min.x) / 2 + radius;
    const hd = (aabb.max.z - aabb.min.z) / 2 + radius;
    const overlapX = hw - Math.abs(out.x - cx);
    const overlapZ = hd - Math.abs(out.z - cz);
    if (overlapX < overlapZ) {
      out.x += out.x < cx ? -overlapX : overlapX;
    } else {
      out.z += out.z < cz ? -overlapZ : overlapZ;
    }
  }
  return out;
}

/** Simple ray vs AABB intersection, returns distance or Infinity */
export function raycastAABB(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  aabb: AABB
): number {
  let tmin = -Infinity, tmax = Infinity;
  const axes = ['x', 'z', 'y'] as const;
  for (const ax of axes) {
    const invD = 1 / dir[ax];
    let t1 = (aabb.min[ax] - origin[ax]) * invD;
    let t2 = (aabb.max[ax] - origin[ax]) * invD;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return Infinity;
  }
  return tmin >= 0 ? tmin : Infinity;
}
