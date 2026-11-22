// The Obsidian Vault — simulation. Fixed-step, deterministic given a seed.
// No rendering or sound here: this file only moves the world and decides
// what happened (picked up, spotted, caught, escaped, timed out).
import { ALARM, CAMERA, FIELD, GUARD, LEVELS, PLAYER, SMOKE, STAR_VALUE, TIME_BONUS_PER_SECOND, ALARM_BONUS_PER_POINT } from './config.js';
import { createRandom } from './random.js';

export const EVENT_PICKED = 1;
export const EVENT_STAR = 2;
export const EVENT_ALERT = 4;
export const EVENT_SMOKE = 8;
export const EVENT_DOOR = 16;
export const EVENT_WIN = 32;
export const EVENT_LOSE = 64;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Does segment p1->p2 intersect rectangle r? Slab method.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function hasLineOfSight(x1, y1, x2, y2, walls) {
  for (const w of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}

// Distance from (x,y) along angle until a wall or maxDist. Used for cone rays.
export function rayDistance(x, y, angle, maxDist, walls) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const r of walls) {
    // Slab test for the ray.
    let tmin = 0;
    let tmax = best;
    let hit = true;
    if (dx === 0) {
      if (x < r.x || x > r.x + r.w) hit = false;
    } else {
      let t1 = (r.x - x) / dx;
      let t2 = (r.x + r.w - x) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) hit = false;
    }
    if (hit) {
      if (dy === 0) {
        if (y < r.y || y > r.y + r.h) hit = false;
      } else {
        let t1 = (r.y - y) / dy;
        let t2 = (r.y + r.h - y) / dy;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) hit = false;
      }
    }
    if (hit && tmin < best) best = Math.max(0, tmin);
  }
  return best;
}

function circleHitsWalls(x, y, radius, walls) {
  for (const w of walls) {
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

function moveCircle(state, x, y, dx, dy, radius) {
  const walls = state.level.walls;
  let nx = x + dx;
  if (!circleHitsWalls(nx, y, radius, walls)) x = nx;
  let ny = y + dy;
  if (!circleHitsWalls(x, ny, radius, walls)) y = ny;
  x = Math.max(radius + 2, Math.min(FIELD.width - radius - 2, x));
  y = Math.max(radius + 2, Math.min(FIELD.height - radius - 2, y));
  return { x, y };
}

function pointInSmoke(x, y, smokes) {
  for (const s of smokes) {
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy < s.r * s.r) return true;
  }
  return false;
}

// Does the segment observer->player pass through any smoke cloud?
function smokeBlocks(x1, y1, x2, y2, smokes) {
  for (const s of smokes) {
    // Distance from smoke centre to the segment.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((s.x - x1) * dx + (s.y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const ddx = s.x - px;
    const ddy = s.y - py;
    if (ddx * ddx + ddy * ddy < s.r * s.r * 0.7) return true;
  }
  return false;
}

function canSee(ox, oy, angle, range, halfAngle, px, py, state) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { seen: false, dist };
  if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return { seen: false, dist };
  if (!hasLineOfSight(ox, oy, px, py, state.level.walls)) return { seen: false, dist };
  if (smokeBlocks(ox, oy, px, py, state.smokes)) return { seen: false, dist };
  if (pointInSmoke(px, py, state.smokes)) return { seen: false, dist };
  return { seen: true, dist };
}

export function createWorld(levelIndex, seed) {
  // Deep-copy the level's loot: LEVELS is shared, and taken flags must not
  // leak from one world (or one restart) into the next.
  const level = {
    ...LEVELS[levelIndex],
    loot: LEVELS[levelIndex].loot.map((l) => ({ ...l, taken: false })),
  };
  const rand = createRandom(seed * 1000 + levelIndex * 77 + 13);
  const state = {
    levelIndex,
    level,
    seed,
    rand,
    time: 0,
    timeLeft: level.time,
    alarm: 0,
    score: 0,
    lootValue: 0,
    lootTaken: 0,
    lootTotal: level.loot.length,
    starTaken: false,
    smokeLeft: SMOKE.perLevel,
    smokes: [],
    status: 'playing', // playing | leveldone | win | caught | timeout
    statusReason: '',
    player: {
      x: level.start.x, y: level.start.y, facing: -Math.PI / 2,
      moving: false, sneaking: false, speed: 0,
    },
    guards: level.guards.map((g, i) => ({
      waypoints: g.waypoints,
      wp: 0,
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      // Spread guards along their route by phase so the opening frame is alive.
      facing: 0,
      suspicion: 0,
      mode: 'patrol', // patrol | chase | return
      chaseTimer: 0,
      lostTimer: 0,
      alerted: false,
      phase: g.phase ?? 0,
    })),
    cameras: level.cameras.map((c) => ({
      x: c.x, y: c.y, baseAngle: c.baseAngle, sweep: c.sweep,
      angle: c.baseAngle, t: 0, alerted: false,
    })),
    seenBy: null, // 'guard' | 'camera' | null, for the HUD
    spotted: false,
  };
  // Advance guards along their patrol by their phase so they are not all
  // bunched at the first waypoint when the game starts.
  for (const g of state.guards) {
    const total = g.waypoints.length;
    const steps = Math.floor(g.phase * total);
    g.wp = steps % total;
    const wp = g.waypoints[g.wp];
    g.x = wp[0];
    g.y = wp[1];
    const next = g.waypoints[(g.wp + 1) % total];
    g.facing = Math.atan2(next[1] - g.y, next[0] - g.x);
  }
  return state;
}

export function resetWorld(state) {
  const fresh = createWorld(state.levelIndex, state.seed);
  fresh.score = state.score; // score carries across levels
  return fresh;
}

// Step the world one fixed step. input: {x, y} unit vector (0,0 = no keys),
// sneak: boolean, useSmoke: boolean (edge). Returns an event bitmask.
export function stepWorld(state, dt, input, sneak, useSmoke) {
  if (state.status !== 'playing') return 0;
  let events = 0;
  state.time += dt;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.status = 'timeout';
    state.statusReason = 'Shift change — the museum opened and the guards swept the building.';
    return EVENT_LOSE;
  }

  const p = state.player;
  const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const moving = input.x !== 0 || input.y !== 0;
  p.moving = moving;
  p.sneaking = sneak && moving;
  p.speed = moving ? speed : 0;
  if (moving) {
    const moved = moveCircle(state, p.x, p.y, input.x * speed * dt, input.y * speed * dt, PLAYER.radius);
    p.x = moved.x;
    p.y = moved.y;
    p.facing = Math.atan2(input.y, input.x);
  }

  if (useSmoke && state.smokeLeft > 0) {
    state.smokeLeft -= 1;
    state.smokes.push({ x: p.x, y: p.y, r: SMOKE.radius, ttl: SMOKE.seconds });
    events |= EVENT_SMOKE;
  }
  for (const s of state.smokes) s.ttl -= dt;
  state.smokes = state.smokes.filter((s) => s.ttl > 0);

  // --- Cameras sweep ---
  for (const cam of state.cameras) {
    cam.t += dt;
    cam.angle = cam.baseAngle + Math.sin(cam.t * CAMERA.sweepSpeed) * cam.sweep;
  }

  // --- Detection (strongest observer only, so two cones do not insta-fail) ---
  let bestRate = 0;
  let seenBy = null;
  let anySeen = false;
  for (const g of state.guards) {
    const res = canSee(g.x, g.y, g.facing, GUARD.viewRange, GUARD.viewHalfAngle, p.x, p.y, state);
    if (res.seen) {
      anySeen = true;
      seenBy = 'guard';
      const closeness = 1 - (res.dist / GUARD.viewRange) * 0.45;
      const rate = GUARD.spotRate * closeness * (p.sneaking ? 0.55 : 1);
      if (rate > bestRate) bestRate = rate;
      g.suspicion = Math.min(1, g.suspicion + dt * 1.6);
      if (g.suspicion > 0.55 && g.mode !== 'chase') {
        g.mode = 'chase';
        g.chaseTimer = GUARD.chaseTime;
        g.lostTimer = 0;
        if (!g.alerted) {
          g.alerted = true;
          events |= EVENT_ALERT;
        }
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - dt * 0.7);
      if (g.suspicion <= 0.05) g.alerted = false;
    }
  }
  for (const cam of state.cameras) {
    const res = canSee(cam.x, cam.y, cam.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, p.x, p.y, state);
    cam.alerted = res.seen;
    if (res.seen) {
      anySeen = true;
      if (!seenBy) seenBy = 'camera';
      const closeness = 1 - (res.dist / CAMERA.viewRange) * 0.45;
      const rate = CAMERA.spotRate * closeness * (p.sneaking ? 0.55 : 1);
      if (rate > bestRate) bestRate = rate;
    }
  }
  state.seenBy = anySeen ? seenBy : null;
  state.spotted = anySeen;

  if (anySeen) {
    state.alarm = Math.min(ALARM.max, state.alarm + bestRate * dt);
  } else {
    state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
  }

  // --- Hearing: walking (not sneaking) close to a guard raises the alarm ---
  if (moving && !sneak) {
    for (const g of state.guards) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < PLAYER.hearRadius) {
        state.alarm = Math.min(ALARM.max, state.alarm + ALARM.hearRate * dt);
        break;
      }
    }
  }

  // --- Guards move ---
  for (const g of state.guards) {
    if (g.mode === 'chase') {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const moved = moveCircle(state, g.x, g.y, (dx / dist) * GUARD.chaseSpeed * dt, (dy / dist) * GUARD.chaseSpeed * dt, GUARD.radius);
        g.x = moved.x;
        g.y = moved.y;
        g.facing = Math.atan2(dy, dx);
      }
      g.chaseTimer -= dt;
      const res = canSee(g.x, g.y, g.facing, GUARD.viewRange, GUARD.viewHalfAngle, p.x, p.y, state);
      if (!res.seen) {
        g.lostTimer += dt;
      } else {
        g.lostTimer = 0;
      }
      if (dist < GUARD.radius + PLAYER.radius + 4) {
        state.alarm = ALARM.max;
      }
      if (g.chaseTimer <= 0 || g.lostTimer > 1.5) {
        g.mode = 'return';
      }
    } else if (g.mode === 'return') {
      // Head for the nearest waypoint, then resume patrol.
      let best = 0;
      let bestD = Infinity;
      g.waypoints.forEach((wp, i) => {
        const d = Math.hypot(wp[0] - g.x, wp[1] - g.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const wp = g.waypoints[best];
      const dx = wp[0] - g.x;
      const dy = wp[1] - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        g.wp = best;
        g.mode = 'patrol';
      } else {
        const moved = moveCircle(state, g.x, g.y, (dx / dist) * GUARD.returnSpeed * dt, (dy / dist) * GUARD.returnSpeed * dt, GUARD.radius);
        g.x = moved.x;
        g.y = moved.y;
        g.facing = Math.atan2(dy, dx);
      }
    } else {
      const wp = g.waypoints[g.wp];
      const dx = wp[0] - g.x;
      const dy = wp[1] - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        g.wp = (g.wp + 1) % g.waypoints.length;
      } else {
        const moved = moveCircle(state, g.x, g.y, (dx / dist) * GUARD.patrolSpeed * dt, (dy / dist) * GUARD.patrolSpeed * dt, GUARD.radius);
        g.x = moved.x;
        g.y = moved.y;
        const target = Math.atan2(dy, dx);
        g.facing = clampAngle(g.facing + clampAngle(target - g.facing) * Math.min(1, dt * 8));
      }
    }
  }

  // --- Loot pickup ---
  for (const item of state.level.loot) {
    if (item.taken) continue;
    const d = Math.hypot(p.x - item.x, p.y - item.y);
    if (d < PLAYER.radius + 26) {
      item.taken = true;
      state.lootTaken += 1;
      state.lootValue += item.value;
      state.score += item.value;
      if (item.kind === 'star') {
        state.starTaken = true;
        events |= EVENT_STAR | EVENT_DOOR;
      } else {
        events |= EVENT_PICKED;
      }
    }
  }

  // --- Alarm full: lockdown ---
  if (state.alarm >= ALARM.max) {
    state.status = 'caught';
    state.statusReason = 'Alarm at 100% — lockdown! The guards sealed every door.';
    return events | EVENT_LOSE;
  }

  // --- Exit: only open once the Star is taken ---
  if (state.starTaken) {
    const e = state.level.exit;
    if (p.x > e.x - 6 && p.x < e.x + e.w + 6 && p.y > e.y - 6 && p.y < e.y + e.h + 6) {
      const timeBonus = Math.round(state.timeLeft) * TIME_BONUS_PER_SECOND;
      const alarmBonus = Math.round(ALARM.max - state.alarm) * ALARM_BONUS_PER_POINT;
      state.score += timeBonus + alarmBonus;
      state.status = state.levelIndex >= LEVELS.length - 1 ? 'win' : 'leveldone';
      state.statusReason =
        state.status === 'win'
          ? `Clean getaway! Time bonus +${timeBonus}, quiet bonus +${alarmBonus}.`
          : `Level clear! Time bonus +${timeBonus}, quiet bonus +${alarmBonus}.`;
      return events | EVENT_WIN;
    }
  }

  return events;
}

// Vision cone polygon (for rendering): fan of rays clipped by walls.
export function conePolygon(x, y, angle, range, halfAngle, walls, rays = 26) {
  const pts = [{ x, y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = rayDistance(x, y, a, range, walls);
    pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return pts;
}
