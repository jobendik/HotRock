# Hot Rock — Netcode & Multiplayer Plan

The slice ships as a local simulation vs bots. This document is the blueprint for turning it
into **authoritative, real-time multiplayer** — and, crucially, for doing so **without changing
the UI layer at all**.

## 1. Guiding principle
> Multiplayer is introduced entirely behind **one seam** — the `WorldModel` — and continues to
> drive the UI through the same `core/events.ts` contract.

Today a `LocalWorldModel` runs the whole simulation in the browser. Tomorrow a
`NetworkedWorldModel` forwards inputs to a server and renders authoritative snapshots. The HUD,
menus, minimap, and toasts never know the difference, because they only ever consumed the typed
event bus + store snapshot. This is the entire payoff of the architecture in `docs/ARCHITECTURE.md`.

## 2. The seam: `WorldModel`
`WorldScene` owns rendering + input capture and delegates **all** simulation:
```ts
export interface WorldModel {
  start(seed: number, config: RoundConfig): void;
  update(dtMs: number, localInput: InputFrame): void;
  getView(): WorldView;   // read-only; drives rendering, HUD + minimap snapshots
  stop(): void;
}
```
- **`LocalWorldModel`** — contains the pure `GameSim` + server-style `BotAI` + RNG. Authoritative locally.
- **`NetworkedWorldModel`** — sends `InputFrame`s to the server, applies authoritative snapshots,
  predicts the local boat, interpolates remotes, and reconciles on correction. Same interface.

Because `GameSim` is **pure and transport-agnostic** (no Phaser, no DOM), the *same simulation
code runs on the server*. Write the rules once; run them in two places.

## 3. Topology
**Authoritative dedicated server.** Clients send intents and render snapshots; they never own truth.

Transport options:
- **WebSocket (TCP)** — simplest, universal on CrazyGames, fine for ~20–40 players at 15–20Hz
  snapshots with delta compression. **Start here.**
- **WebRTC DataChannel (unreliable, UDP-like)** via **geckos.io** — lower latency and far better
  under packet loss. Adopt if the steal/extract feel suffers on WS.

Server framework:
- **Custom Node + `ws` (or geckos.io) wrapping `GameSim`** — full control of the netcode model
  (prediction/reconciliation), which an action game wants. **Recommended.**
- **Colyseus** — rooms, state sync, and matchmaking out of the box; a faster path if you accept its
  state-sync model. Fine alternative; you'll still run `GameSim` inside a room's `onSimulate`.

Pick one and record it as an ADR. Default recommendation: **custom `ws` + `GameSim` now, geckos.io as the latency upgrade.**

## 4. Tick & rates
| Loop | Rate |
| --- | --- |
| Server simulation tick (fixed dt) | **30 Hz** |
| Snapshot broadcast (delta-compressed) | **15–20 Hz** (every 2nd tick) |
| Client input send (coalesced, sequenced) | **30 Hz** |
| Client render (interpolated) | rAF (~60 fps) |

Fixed dt + seeded RNG ⇒ deterministic server simulation, identical to the local one.

## 5. Message schema (JSON first → binary later)
Start with JSON for debuggability; migrate hot messages to **msgpack/flatbuffers** with
quantized fields (int16 positions, packed flags) once stable.

**Client → Server**
- `join { name, region, version }`
- `input { seq, dtMs, joystick{x,y}, actions /*bitfield: boost|dig|tool*/, useTool?, buyUpgrade? }`
- `pong { t }`

**Server → Client**
- `welcome { playerId, tickRate, snapshotRate, world, seed }`
- `snapshot { tick, ackSeq, full?, entities[], rock, round, removed[] }`
  - `entities[]`: `{ id, x, y, vx, vy, angle, flags(carrying|boosting|smoke), speedTier }`
    (cash is sent only for the local player or omitted entirely)
- `event { ...one of the domain events from core/events.ts }` — the server emits **authoritative**
  `rock:stolen`, `dig:completed`, `round:ended`, etc.; the client forwards them onto the **same bus**,
  so the UI reacts identically to single-player.
- `ping { t }`

## 6. Client-side prediction & reconciliation (local boat only)
- The client applies each `InputFrame` to **its own boat immediately** through the same movement
  step (prediction), and stores unacked inputs keyed by `seq`.
- On a `snapshot` carrying `ackSeq`: snap the local boat to the server's authoritative state for that
  seq, then **replay all inputs with `seq > ackSeq`** to recover the present. Smooth small position
  errors (lerp over a few frames); snap on large divergence.
- **Only movement is predicted.** Steals / pickups / extraction are **not** predicted as truth — show
  optimistic VFX, but treat the server's `rock:*` events as authoritative (cheap, since the UI already
  reacts to those events).

## 7. Remote entity interpolation
Render remote boats **~100 ms in the past** (interpolation delay ≈ 1.5–2 snapshot intervals). Keep a
short per-entity buffer of recent snapshots and render by interpolating between the two that straddle
the render timestamp. Briefly extrapolate (cap ~150 ms) if the buffer starves. Standard, jitter-free.

## 8. Authority for the signature moments
- **Movement** — predicted client-side, **validated** server-side (clamp to max speed incl. upgrades +
  boost; reject teleports). Never trust client positions.
- **Ram-steal** — resolved on the **server** from server positions + relative velocity at the colliding
  tick. Optional **lag compensation**: the server rewinds the carrier's recent position by the attacker's
  RTT/2 (keep a short history ring) when testing the hit. Ship without lag-comp first; add it only if
  stealing feels unfair under latency.
- **Rock pickup / drop / extract** — **100% server-authoritative.** The server assigns ownership,
  enforces `dropLockout`, runs the extract hold timer, declares the winner, and emits `rock:*` +
  `round:ended`. Clients render predicted feedback but reconcile to server truth.

## 9. Bots
Bots run on the **server**, using the **same `BotAI` pure function** the slice uses, fed server
snapshots. They fill rooms under capacity, take over the boat of a player who disconnects, and are
flagged `isBot` for rendering/labels. In the slice the identical `BotAI` runs inside `LocalWorldModel` —
**zero rewrite** when you go online.

## 10. Rooms, matchmaking, backfill
- A **stateless matchmaker** assigns players to **region-aware room servers**, target ~20–40 per room.
- Room lifecycle: `warmup → active round → results → reset`, rolling. Players **join mid-round and spawn
  immediately** at a safe edge.
- **Backfill** keeps population near target with bots; when a human joins, optionally replace a bot.
  When a human leaves, a bot takes over their boat (or it despawns after a grace period).
- Drop-in / drop-out is essential for .io retention — **never gate on "waiting for players."**

## 11. Cheat resistance
- The authoritative server is the whole defense: clients send **intents only**; the server owns
  positions, cash, ownership, and timers.
- Validate: max speed (tier + boost aware), input **rate limits**, sane `dt`, plausible joystick magnitude.
- **Interest management (AoI)**: send each client only nearby entities — cuts bandwidth *and* reduces
  wallhack value. Optional at slice-map scale; valuable as counts grow.
- Cash/gems accrue **only** server-side; never accept client-reported economy.

## 12. Reconnection & lag handling
Heartbeat `ping`/`pong`; RTT drives the interpolation delay and any lag-comp. On disconnect, a bot
drives the boat during a grace window; on reconnect within it, hand control back and resume from the
current snapshot. Past the window, treat as a fresh join next round.

## 13. Persistence & infra (off the hot path)
Realtime room servers are ephemeral re: progression. A separate **HTTP service + DB** handles accounts,
cosmetics, currency, and stats (written **after** a round ends). Deploy room servers **regionally**;
scale horizontally by spinning rooms behind a thin gateway/matchmaker; containerize and autoscale on CCU.
On CrazyGames: use **WSS** endpoints, keep the client bundle CDN-served, and let the SDK handle ads/auth
(not transport).

## 14. Migration plan (each step is shippable)
1. **(Now, in the slice)** Introduce the `WorldModel` seam; `WorldScene` uses `LocalWorldModel`. Keep all
   rules in the pure, transport-agnostic `GameSim`. UI already speaks the event contract. *(Done as part of M4–M5.)*
2. Stand up a Node server importing the **same** `GameSim`; run an authoritative loop with 1 human + bots;
   add WS transport + the JSON message schema.
3. Implement `NetworkedWorldModel` on the client (send inputs, apply snapshots; **interpolate everything,
   no prediction yet**). Online and playable, with input latency. Verify the event-mirror lights up the UI unchanged.
4. Add **client-side prediction + reconciliation** for the local boat and a **remote interpolation buffer**; tune delay.
5. Add **rooms, region matchmaking, backfill bots, drop-in/out, reconnection**.
6. **Harden:** delta compression, binary encoding, AoI, optional lag-comp for steals, rate limits,
   metrics/logging, load test to target CCU.
7. Wire the **persistence/cosmetics** service, analytics, and the CrazyGames QA pass.

## 15. What stays the same (the payoff)
- `src/ui/**` — **untouched**.
- `src/core/events.ts` — same events; the server simply becomes another emitter (via
  `NetworkedWorldModel` forwarding server events onto the bus).
- `src/sim/GameSim`, `sim/BotAI`, `src/config/balance.ts` — **shared verbatim** between client
  (local mode) and server (authoritative mode).

This is exactly why the slice invests in the `WorldModel` seam and a pure `GameSim` from day one.
