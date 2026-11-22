# Build log — The Obsidian Vault (make.fun heist bounty)

Honest working log of the coding session that built this entry. The harness
session log is held by the parent Muse app session; this file records what
was actually done here, in this workspace, so the entry's provenance is
checkable. No log was fabricated.

## Session

- Bounty: `best-heist-game-20261122-0559` — "Make the best heist game",
  $50 USDC, 10 places paid. Deadline Sun 2026-11-22 17:59 UTC.
- Built: 2026-11-22, ~09:12–09:30 UTC, in `~/workspace/makefun-heist-game/`.
- Environment: Node v24.22.1, npm 10.9.4, no system Chrome. Screenshots and
  play-tests used the Playwright headless shell installed during the session
  (`~/.cache/ms-playwright/chromium_headless_shell-1255`).
- Kit: downloaded from `https://make.fun/c/best-heist-game-20261122-0559/kit`
  to `/tmp/makefun/kit.tar.gz`, unpacked to
  `/tmp/makefun/best-heist-game-20261122-0559-kit/`. The starter inside was a
  Block Dodger demo; it was used as an architecture pattern only (fixed
  1280x720 field, seeded RNG, fixed timestep, `?shot=` staging), not copied
  as a game. `vendor/makefun-game.ts` was copied from the kit byte-identical
  (sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`).

## What was built

- `game/src/config.js` — 3 levels (The Gallery, The Vault Wing, The Crown
  Chamber), guards/cameras/loot/walls, tuning constants.
- `game/src/world.js` — rules: movement + wall collision, guard patrol /
  suspicion / chase, camera sweeps, cone + line-of-sight detection, smoke,
  alarm 0–100, loot + star unlocks EXIT, timer, score.
- `game/src/render.js` — Canvas 2D art (all procedural), HUD with alarm
  meter, title/play/level-clear/win/busted/pause screens.
- `game/src/input.js`, `audio.js` (WebAudio synth, no files), `random.js`
  (mulberry32), `shots.js` (deterministic staged scenes + autopilot),
  `main.js` (loop, screen state machine).
- `game/index.html`, `shots.json`, `serve.ts`, `main.ts`, `LICENSE` (MIT),
  `README.md`.

## Bugs found and fixed in this session

1. Autopilot probe passed a `{x, y}` object but read it as an array —
   produced NaN movement. Fixed to `dir.x` / `dir.y`.
2. Autopilot stalled: a 0.5 s greedy probe overshot close targets, so every
   direction scored worse than standing still. Rewrote the autopilot with a
   coarse-grid BFS/A* pathfinder plus probe scoring by closest approach
   during the probe (not just the endpoint), with loot/star bonuses.
3. Guard patrol lanes clipped wall corners (guard radius 14 vs wall edges
   10 px away), so guards stuck mid-patrol. Moved waypoints and one wall in
   all three levels; validated with `/tmp/validate.mjs` (patrol clearance +
   start/exit/loot placement) — PATROL+PLACEMENT OK.
4. Level loot objects were shared with the global LEVELS table, so `taken`
   flags leaked between worlds/restarts. `createWorld` now deep-copies loot.
5. `startLevel` reset the score to 0 when advancing a wing. It now carries
   the score forward; a fresh game still starts at 0.
6. `R` did nothing on the game-over screen, and "TRY AGAIN" restarted the
   whole heist from wing 1. `R` now retries the current wing, and so does
   Enter / TRY AGAIN.
7. HUD overlap: the "STAR SECURED" banner was drawn on top of the ALARM
   label. It is now a pill below the top bar. Edge cameras' "CAM" labels
   were clipped at the screen edges; cameras moved inward and labels
   repositioned. Walls were near-black voids; they now have gold outlines.

## Verification (all run in this session)

- Node simulation (`/tmp/test-shots.mjs`, seed 7): start = title, thief at
  start, loot 0/5, alarm 0. play = mid-heist, score 350, loot 2/5, alarm 18.
  stealth = sneaking, score 500, loot 3/5, alarm 0. end = full 3-wing
  playthrough to CLEAN GETAWAY, score 9575, loot 4/7, alarm 1.
- Browser (Playwright headless shell, `node serve.ts --port 8080`):
  title → click START → play; WASD moved the thief (90,650) → (366,374);
  smoke bomb 2 → 1 with an active cloud; P paused and resumed;
  click-to-move walked the thief; canvas pixels non-blank; zero external
  network requests; zero page errors.
- Caught path: 0.75 s of exposure in a guard's cone → alarm 100 →
  BUSTED screen. Timeout path: timeLeft 1.2 s → timeout screen with the
  shift-change reason. R and Enter retry the wing.
- Built copy `out/game` served separately on port 8081: `?shot=play`
  staged identically (score 350, alarm 18).
- Screenshots: 4 JPEGs, each < 256 KiB, visually inspected — every frame
  shows the room, guards with vision cones, cameras, loot (incl. the
  Obsidian Star), and the alarm meter.
- Dossier: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` exits 0;
  `out/dossier.json` is schema `makefun/dossier/v1`, cover 0, 4 images,
  text 63,047 bytes (cap 163,840). game/ is 9 files, 61,902 bytes
  (caps: 993 files, 48 MiB).

## Not done here (needs the user)

- No entry was submitted, no Solana keypair or make.fun account was created,
  and no GitHub/Discord/wallet was connected by this session.
- README still carries `{owner}`, `{repo}` and `{referral_code}`
  placeholders — the make.fun intake check refuses a README with
  placeholders. The user must supply their GitHub owner/repo (and referral
  code) and the repo must be created after the competition opened, then
  pushed and submitted before 2026-11-22 17:59 UTC.
- The parent agent holds the harness session log that the submission
  bundles as the build transcript; this file is the workspace-side record.
