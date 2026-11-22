# The Obsidian Vault — Midnight Heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/loeloe225/Tirmchdohl-/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/loeloe225/Tirmchdohl-/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

You are Rook, the thief. Midnight at the Grand Meridian Museum: steal the
Obsidian Star, grab what you can, and slip out the EXIT before the alarm
hits 100% or the guards change shift. A top-down stealth heist in three
wings — The Gallery, The Vault Wing, and The Crown Chamber — with patrolling
guards and their vision cones, sweeping security cameras, a rising alarm
meter, smoke bombs, sneaking, a per-level timer, and a score that rewards
loot, speed, and staying quiet. Everything is drawn and sounded procedurally
in the browser: no images, no audio files, no network requests.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Requires Node 22+. The game is plain static files under `game/` — open
`game/index.html` from any static server and it plays offline in a desktop
browser. Screenshots are staged deterministically with
`http://localhost:8080/?shot=start|play|stealth|end&seed=7`.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Sneak (slower, silent, harder to spot) |
| Space / E | Smoke bomb (2 per level, blocks vision for 4 s) |
| Click | Walk to that spot |
| P / Esc | Pause |
| M | Mute |
| R | Restart the current wing (also retries after getting busted) |
| Enter | Start / advance |

## How it plays

- **Guards** patrol waypoints with vision cones. Being seen raises the
  alarm; guards chase for 3 seconds, then return to patrol.
- **Cameras** sweep the halls on their own arcs. Their cones count too.
- **Alarm 0–100**: rises while any guard or camera sees you (faster up
  close, slower while sneaking), decays when you are unseen, and rises a
  little when you walk loudly near a guard. At 100% the heist is over.
- **Smoke** breaks line of sight for guards and cameras.
- **Loot**: the Obsidian Star ($1000) unlocks the EXIT door; gold ($150),
  paintings ($200–250) and jewels ($300) are optional. Score = loot +
  time bonus + quiet bonus.
- **Timer** per wing (150/165/180 s): run out and the museum opens.

## Files

- `game/` — the game: `index.html` plus ES modules in `src/` (world rules,
  rendering, input, sound, level data, deterministic screenshot staging).
- `screenshots/` — four real renders of the game's own code (title, mid-heist
  with the alarm rising, sneaking, clean getaway).
- `main.ts` — the make.fun entry program: copies `game/` and `screenshots/`
  to the output directory and writes `dossier.json`.
- `vendor/makefun-game.ts` — the make.fun library, copied from the kit
  unchanged.
- `shots.json` — the four screenshot scenes and their seed.
- `serve.ts` — a tiny static server for local play-testing.

---

<sub>Entered on [make.fun](https://make.fun/?ref=m4737tkj&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
