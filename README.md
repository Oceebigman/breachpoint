# BREACHPOINT

A lightweight tactical first-person shooter that runs in a modern desktop browser. Two teams fight over high-value objectives on a compact original map. Attackers plant a device; defenders defuse it or hold out until time expires.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- **Renderer**: Three.js / WebGL 2 — scene, lighting, collision, bot meshes, effects
- **Game logic**: TypeScript modules (core, world, weapons, bots, modes, renderer)
- **UI**: React + Tailwind CSS (menus, HUD, scoreboard, results)
- **Build**: Vite

## Development

### Prerequisites

- Node.js 18+ and Bun

### Install

```bash
bun install
```

### Environment variables

None required for local development. The game runs entirely client-side in the browser.

### Run

```bash
bun run dev
```

Open `http://localhost:5173` in a modern desktop browser (Chrome or Firefox recommended for pointer lock support).

### Build

```bash
bun run build
```

### Lint and typecheck

```bash
bun run check
```

## Gameplay

**Controls**

| Input | Action |
|-------|--------|
| WASD | Move |
| Mouse | Aim / look |
| Left mouse | Fire |
| Right mouse (hold) | Aim down sights |
| R | Reload |
| Shift | Sprint |
| Ctrl / C | Crouch |
| Space | Jump |
| E (hold) | Interact — plant / defuse objective |
| Tab (hold) | Scoreboard |
| Esc | Release pointer lock |

**Mode: BREACH**

- Attackers plant a device at Site A or Site B; defenders disarm it or eliminate the attackers
- First team to 6 round wins takes the match
- 90-second active phase per round; 40-second fuse timer when device is armed

**Map: IRONGATE**

Industrial security facility. Two main approach corridors, a central hub with the primary objective, a south wing (Site B), and flanking routes on both sides.

**Bots**

Solo practice is available at Easy, Normal, and Hard difficulty. Bot results are personal records stored in localStorage and are separate from any future server-validated ranked results.

## Architecture

```
src/
  game/
    core.ts       Event bus, clock, phase types
    world.ts      Map definition, collision AABBs, spawn points, raycasting
    weapons.ts    Data-driven weapon defs, fire/reload state machine
    bots.ts       Bot AI: patrol, engage, objective navigation
    modes.ts      BREACH round rules, objective FSM, scoring
    renderer.ts   BPRenderer — Three.js scene, player controller, game loop
    session.ts    Re-export bridge for React
  components/
    MainMenu.tsx
    LobbySetup.tsx
    HUD.tsx
    MatchResults.tsx
    SettingsScreen.tsx
    LeaderboardScreen.tsx
  App.tsx         Screen router, BPRenderer lifecycle
```

## Phase roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | Done | Audit, architecture, acceptance criteria |
| 1 | Done | Local vertical slice: controls, map, weapons, bots, BREACH mode, HUD, results |
| 2 | Planned | Polish: recoil curves, audio, effects, map art, performance profiling |
| 3 | Planned | Multiplayer: WebSocket rooms, server-authoritative state, two real browser clients |
| 4 | Planned | Persistence: server-validated results, leaderboards, idempotency, anti-farming |
| 5 | Planned | Optional Web3: cosmetic ownership (no pay-to-win, no wallet required to play) |

## Known limitations (Phase 1)

- Solo practice only (no online multiplayer yet)
- No audio (sound system deferred to Phase 2)
- Bot hit detection is approximate (client-side only — not suitable for ranked play)
- Leaderboards store personal bests in localStorage only (no server validation)
- No killcam or replay
- Mobile and Safari not yet tested (pointer lock behaviour differs)

## Asset credits

All geometry is procedurally generated. No external 3D models, textures, or sounds are used. Three.js is MIT licensed.
