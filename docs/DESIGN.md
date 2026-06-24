# Hot Rock — Game Design

## 1. Vision
A bright, chaotic, **3-minute** smash-and-grab on the open sea. Everyone is hunting one
prize — **the Rock** — and the instant it's found, the calm treasure hunt becomes a
lobby-wide chase. The fun is **readable drama** (you can always see who has the Rock and
where it is) plus **constant reversal** (anyone is one ram away from winning). It must be
instantly understandable, one-thumb playable on mobile, and produce shareable "STOLEN!" moments.

### Pillars
1. **The hot potato is everything.** The Rock is visible, stealable, and must be physically extracted. No hidden victory.
2. **Always in the race.** No eliminations; getting hit costs cash or a knockback, never a life. Losers still earn (most gems smuggled).
3. **Free-roam, real-time.** Drive anywhere; no turns, no lanes.
4. **Fair & fast.** No pay-to-win; upgrades reset each round; rounds always resolve.
5. **Readable juice.** Light-pillar on the carrier, minimap broadcast, screen-shake on a dock-line steal.

### Theme & naming
Fictional tropical archipelago (justifies boats, seaplanes, reefs/storms, a broadly appealing look).
The macguffin is **"the Rock"** — a legendary diamond. The carrier is *"holding the hot rock."*
The theme is cosmetic; the mechanics port cleanly to space-miners or a getaway-heist reskin if desired.

## 2. Core loop
1. **Prospect (0:00–~1:30).** Roam and dig sites for gems (cash). Never dead time — gems fund live upgrades.
2. **The Rock surfaces.** Whoever digs it triggers a map-wide alert, a beam of light, a music sting. The carrier glows and is pinned on everyone's minimap.
3. **The chase (climax).** The lobby converges. Ram the carrier to knock the Rock loose; grab it; run.
4. **Extract.** Hold the Rock at a black-market **dock** for a few seconds to win.
5. **Results → requeue.** Crown + payout, quick stats, then straight back in.

A global **heat** timer guarantees a finish: hints, then reveal pulses, then (if still undug) the Rock auto-surfaces.

## 3. Systems

### World & camera
Open-water world ≈ `4000×3000` with scattered island colliders. Smooth follow camera with
slight velocity look-ahead and a gentle zoom-out while boosting. Soft walls at the bounds.

### Boat movement
Arcade feel via simple circle physics in the pure sim (NOT Phaser Arcade — see ARCHITECTURE):
thrust toward facing, facing turns toward input with angular lerp, drag when idle.
Juice (render-side only): banking tilt, wake trail, spray on hard turns, light bob.

### Digging
Auto-prompt within `DIG.radius`; **hold** the action for `DIG.timeMs` (radial ring in HUD,
ping on the site in-world). Leaving cancels. On completion, reveal a `DigReward` from the loot table.

### Economy (gems → cash)
Most sites yield gems = cash that floats into the HUD counter. `trap` rewards cause a small
knockback and scatter a few gems for others (no life loss). Cash buys upgrades; everything resets per round.

### Upgrades (bought mid-round, reset each round)
**Engine** (3 speed tiers, `+12%` each), **Refuel Boost**, **Grapple Net** (easier steals),
**Smoke Screen** (vanish from minimap + escape burst), **Sonar Ping** (find nearest site / Rock).
Costs in `balance.ts`. Strictly tactical, never permanent → no pay-to-win.

### Tools
**Boost** is core (charge meter; `×1.8` for `1.5s`; recharges or via Refuel). Net/Smoke/Radar
are purchased consumables with short active windows.

### The Rock (the carryable)
- Hidden at one random site. Digging it → `rock:found`, alert, beam, permanent minimap presence.
- Carrier glows; small speed tax (`carrierSpeedMult`); HUD shows a **direction arrow to the nearest dock**.
- **Steal by ramming:** non-carrier contacts carrier with relative approach speed `> stealSpeed`
  (`stealSpeedWithNet` if the rammer has a Net) → Rock drops (brief scatter + `dropLockoutMs`) and is grabbable within `pickupRadius`.
- **Extract to win:** hold at a **dock** for `EXTRACT.holdMs` (interrupted if rammed off). First to extract wins.

### Docks
2–3 fixed extraction docks at map edges, marked in-world and on the minimap.
(No "visa" item in the slice — *anyone who extracts wins*, which captures the original board game's steal-to-win twist directly.)

### Hazards (1 type for the slice)
A wandering **storm** zone: slows you and nudges your heading inside it — risk/reward routing.
(Reef and Kraken zones are post-slice.)

### Bots
Default 8 (range 4–15). Pure `BotAI` finite-state behaviour: `PROSPECT`, `INTERCEPT`
(cut off the carrier), `CARRY_RUN` (beeline a safe dock, use Smoke), `FLEE`, `STEAL`.
Tuned beatable: reaction delay, aim jitter, occasional dithering. Same code runs the server's bots later.

### Round flow & heat
`ROUND.durationMs ≈ 180s`. Heat (0..1) interpolated from keyframes drives urgency:
cold prospecting → minimap hints toward the Rock site → reveal **pulses** every ~20s →
the storm tightens. If the Rock is still undug at the end it **auto-surfaces** so a finish always happens.
End: Rock extracted, or time expires (leader = holder, else most cash).

### Win / lose / results
No eliminations. The results screen shows the winner and **your** stats (gems smuggled, digs,
steals, time as carrier) so non-winners still feel rewarded. **Play Again → requeue.**

## 4. Controls
- **Desktop:** WASD/arrows steer (optional mouse-aim toggle); **Boost** Shift/Space; **Tool** E/click; **Dig** auto-prompt + hold.
- **Mobile:** DOM **left virtual joystick**; **Boost** + **Tool** buttons bottom-right; **auto-dig** on proximity. Fully one-thumb playable.

## 5. HUD & UX (DOM/CSS only)
Loading → Main Menu (Play / Settings / How to Play) → in-round HUD → Results → requeue.
HUD: round timer + heat meter (top), animated cash + speed tier + boost charge, a **carrier banner**
("💎 {name} has the Rock!") with a direction arrow, the **upgrade bar** (costs/affordability),
a corner **minimap** (DOM `<canvas>`: boats, sites, Rock beam, docks, storm), center prompts
("Hold to dig", "Ram to steal!", "Hold at dock"), and toasts ("STOLEN!", "+250", "Rock surfaced!").
All motion respects `prefers-reduced-motion`.

## 6. Monetization (CrazyGames SDK, no pay-to-win)
Rewarded video for revive-in-place / double round payout / salvage lost gems / daily reward.
Midgame interstitial on the results screen before requeue. Banner in the lobby. **Cosmetics only**
for purchase/earn (boats, wakes, Rock skins, victory emotes) — purely vanity, since all gameplay
upgrades reset each round. SDK details and call sites: `src/platform/crazygames.ts` + `docs/NETCODE.md` is unrelated.

## 7. Balance philosophy
All numbers live in `src/config/balance.ts`; tune there only. Aim for: rounds that resolve in
~2–3 minutes; the Rock found around the 60–120s mark; steals frequent enough to feel chaotic but
not so frequent that extraction is impossible; gems plentiful enough that upgrades feel attainable.

## 8. Out of scope (this slice)
Netcode/servers, accounts/persistence beyond `localStorage` (settings + best score), real art/audio,
anti-cheat, a full cosmetics economy, more than one hazard type, a level editor. Architected so each
slots in later — multiplayer especially (see `docs/NETCODE.md`).
