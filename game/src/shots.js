// Screenshot scenes behind ?shot=start|play|stealth|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
//
// The autopilot navigates with a coarse grid A* (walls block cells), then
// picks, among 9 candidate directions, the one whose short re-simulation
// (probe) makes the most progress toward the next path node while staying
// out of vision cones. Scoring uses the closest approach during the probe,
// not just the endpoint, so it does not stall just short of a target.
import { FIELD, STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { SCREEN_LEVELDONE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const DIRS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const CELL = 40;
const COLS = Math.ceil(FIELD.width / CELL);
const ROWS = Math.ceil(FIELD.height / CELL);

function snapshot(state) {
  return {
    time: state.time,
    timeLeft: state.timeLeft,
    alarm: state.alarm,
    score: state.score,
    lootValue: state.lootValue,
    lootTaken: state.lootTaken,
    starTaken: state.starTaken,
    smokeLeft: state.smokeLeft,
    status: state.status,
    player: { ...state.player },
    guards: state.guards.map((g) => ({ ...g, waypoints: g.waypoints })),
    cameras: state.cameras.map((c) => ({ ...c })),
    smokes: state.smokes.map((s) => ({ ...s })),
    lootFlags: state.level.loot.map((l) => l.taken),
  };
}

function restore(state, snap) {
  state.time = snap.time;
  state.timeLeft = snap.timeLeft;
  state.alarm = snap.alarm;
  state.score = snap.score;
  state.lootValue = snap.lootValue;
  state.lootTaken = snap.lootTaken;
  state.starTaken = snap.starTaken;
  state.smokeLeft = snap.smokeLeft;
  state.status = snap.status;
  Object.assign(state.player, snap.player);
  state.guards.forEach((g, i) => Object.assign(g, snap.guards[i]));
  state.cameras.forEach((c, i) => Object.assign(c, snap.cameras[i]));
  state.smokes = snap.smokes.map((s) => ({ ...s }));
  state.level.loot.forEach((l, i) => {
    l.taken = snap.lootFlags[i];
  });
}

// Re-simulate `seconds` of play in `dir`; return what happened. The state
// is restored to exactly what it was before the probe.
function probe(state, dir, sneak, seconds, steer) {
  const snap = snapshot(state);
  let danger = 0;
  let caught = false;
  let minDist = Math.hypot(steer.x - state.player.x, steer.y - state.player.y);
  const lootBefore = state.lootTaken;
  const starBefore = state.starTaken;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, STEP, { x: dir.x, y: dir.y }, sneak, false);
    if (state.spotted) danger += 1;
    const d = Math.hypot(steer.x - state.player.x, steer.y - state.player.y);
    if (d < minDist) minDist = d;
    if (state.status !== 'playing') {
      caught = state.status === 'caught';
      break;
    }
  }
  const end = {
    x: state.player.x,
    y: state.player.y,
    alarm: state.alarm,
    caught,
    danger,
    minDist,
    lootGain: state.lootTaken - lootBefore,
    starGain: state.starTaken && !starBefore ? 1 : 0,
  };
  restore(state, snap);
  return end;
}

function cellBlocked(level, cx, cy) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  const r = 18;
  for (const w of level.walls) {
    const nx = Math.max(w.x, Math.min(x, w.x + w.w));
    const ny = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Breadth-first path on the coarse grid; returns waypoints in field coords.
function findPath(level, from, to) {
  const sx = Math.max(0, Math.min(COLS - 1, Math.floor(from.x / CELL)));
  const sy = Math.max(0, Math.min(ROWS - 1, Math.floor(from.y / CELL)));
  const tx = Math.max(0, Math.min(COLS - 1, Math.floor(to.x / CELL)));
  const ty = Math.max(0, Math.min(ROWS - 1, Math.floor(to.y / CELL)));
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === tx && cy === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (seen.has(key(nx, ny)) || cellBlocked(level, nx, ny)) continue;
      // No cutting corners through a wall.
      if (dx !== 0 && dy !== 0 && (cellBlocked(level, cx + dx, cy) || cellBlocked(level, cx, cy + dy))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  if (!seen.has(key(tx, ty))) return null;
  const cells = [];
  let cur = [tx, ty];
  while (!(cur[0] === sx && cur[1] === sy)) {
    cells.unshift(cur);
    cur = prev.get(key(cur[0], cur[1]));
    if (!cur) break;
  }
  return cells.map(([cx, cy]) => ({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 }));
}

function targetFor(state) {
  let best = null;
  let bestD = Infinity;
  for (const item of state.level.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    const weighted = item.kind === 'star' ? d * 0.7 : d;
    if (weighted < bestD) {
      bestD = weighted;
      best = item;
    }
  }
  if (state.starTaken) {
    const e = state.level.exit;
    return { x: e.x + e.w / 2, y: e.y + e.h / 2, exit: true };
  }
  return best;
}

// Cached path, recomputed when the target moves or every 40 calls.
let pathCache = { target: null, path: null, age: 0 };

export function autopilot(state, sneak, bold = false) {
  const target = targetFor(state);
  if (!target) return { x: 0, y: 0 };
  pathCache.age += 1;
  if (
    !pathCache.path ||
    pathCache.age > 40 ||
    !pathCache.target ||
    Math.hypot(pathCache.target.x - target.x, pathCache.target.y - target.y) > 1
  ) {
    pathCache = { target: { x: target.x, y: target.y }, path: findPath(state.level, state.player, target), age: 0 };
  }
  // Steer toward the first path node that is still ahead of us.
  let steer = { x: target.x, y: target.y };
  if (pathCache.path) {
    for (const node of pathCache.path) {
      if (Math.hypot(node.x - state.player.x, node.y - state.player.y) > 34) {
        steer = node;
        break;
      }
    }
  }
  const nowD = Math.hypot(steer.x - state.player.x, steer.y - state.player.y);
  let bestDir = DIRS[0];
  let bestScore = -Infinity;
  for (const dir of DIRS) {
    const len = Math.hypot(dir[0], dir[1]) || 1;
    const unit = { x: dir[0] / len, y: dir[1] / len };
    const res = probe(state, unit, sneak, 0.35, steer);
    let score = (nowD - res.minDist) * 3 - (bold ? 0 : res.danger * 25) - Math.max(0, res.alarm - state.alarm) * 0.4;
    score += res.lootGain * 200 + res.starGain * 400;
    if (res.caught) score -= 1000;
    if (dir[0] === 0 && dir[1] === 0) score -= 2; // prefer moving
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  const len = Math.hypot(bestDir[0], bestDir[1]) || 1;
  return { x: bestDir[0] / len, y: bestDir[1] / len };
}

function runFor(state, seconds, sneak, useSmokeWhenSpotted, boldSeconds = 0) {
  pathCache = { target: null, path: null, age: 0 };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.status !== 'playing') break;
    const bold = i < Math.round(boldSeconds / STEP);
    const dir = autopilot(state, sneak, bold);
    let smoke = false;
    if (!bold && useSmokeWhenSpotted && state.spotted && state.smokeLeft > 0 && state.alarm > 25) smoke = true;
    stepWorld(state, STEP, dir, sneak, smoke);
  }
}

// Idle: let guards patrol and cameras sweep while the thief waits at the
// start, so the title frame shows the untouched room.
function idleFor(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.status !== 'playing') break;
    stepWorld(state, STEP, { x: 0, y: 0 }, false, false);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: a few seconds in, title screen. play: mid-heist. stealth: sneaking
 * with the alarm low. end: played to a finish (win if the pilot escapes).
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // Cautious first: the thief collects loot and closes on the Star.
    runFor(world, 5, false, true);
    // Then walk straight at the nearest guard until spotted, so the frame
    // shows a live chase and a rising alarm — all from the real rules.
    if (world.status === 'playing' && world.alarm < 15) {
      const steps = Math.round(3 / STEP);
      for (let i = 0; i < steps; i += 1) {
        if (world.status !== 'playing' || world.alarm >= 25) break;
        let nearest = null;
        let bestD = Infinity;
        for (const g of world.guards) {
          const d = Math.hypot(g.x - world.player.x, g.y - world.player.y);
          if (d < bestD) {
            bestD = d;
            nearest = g;
          }
        }
        const dx = nearest.x - world.player.x;
        const dy = nearest.y - world.player.y;
        const len = Math.hypot(dx, dy) || 1;
        stepWorld(world, STEP, { x: dx / len, y: dy / len }, false, false);
      }
    }
    // Break away, smoke if needed.
    runFor(world, 3, false, true);
    return { screen: world.status === 'playing' ? SCREEN_PLAY : SCREEN_OVER, best: world.score };
  }
  if (name === 'stealth') {
    runFor(world, 12, true, true);
    return { screen: world.status === 'playing' ? SCREEN_PLAY : SCREEN_OVER, best: world.score };
  }
  if (name === 'end') {
    // Play through all three wings to a clean getaway, carrying the score.
    for (let level = 0; level < 3; level += 1) {
      runFor(world, 600, false, true);
      if (world.status === 'win') break;
      if (world.status !== 'leveldone') break;
      if (level < 2) {
        const next = createWorld(level + 1, world.seed);
        next.score = world.score;
        Object.assign(world, next);
      }
    }
    if (world.status === 'win') return { screen: SCREEN_WIN, best: world.score };
    if (world.status === 'leveldone') return { screen: SCREEN_LEVELDONE, best: world.score };
    return { screen: SCREEN_OVER, best: world.score };
  }
  // start (default): the thief waits at the door while the museum lives.
  idleFor(world, 3);
  return { screen: SCREEN_TITLE, best: 0 };
}

export { FIELD };
