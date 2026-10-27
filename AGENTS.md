# BREACHPOINT — Tactical Browser FPS

> Built with Arc Studio

Phase 1 vertical slice: BREACH mode, IRONGATE map, solo practice with bots.

## Architecture
- Game engine: `src/game/` — pure TypeScript + Three.js, no external assets
- `BPRenderer` (renderer.ts): self-contained game loop, emits `GameSnapshot` to React via `onSnapshot` callback
- Map IRONGATE defined in `world.ts` `buildIrongateMap()` — procedural geometry only
- Three.js v0.186.1

## Key decisions
- Existing `BPRenderer`/`modes.ts`/`bots.ts` kept from prior session; only fixed lint (void requestPointerLock)
- New modules: world.ts (AABB collision), weapons.ts (data-driven defs), core.ts (event bus + clock)
- UI components read from `GameSnapshot` only — no game state in React
- Bot scores stored in `localStorage` (personal bests only, not server-validated)

## Phase 2 next
- WebAudio spatial sound, recoil polish, map art pass, performance profiling

## Phase 3 next
- Node.js WebSocket server: authoritative health/damage/objective/score, room codes

## No deployed contracts
Pure browser game — no smart contracts in Phase 1.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
