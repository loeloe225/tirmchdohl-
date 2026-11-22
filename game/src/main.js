// The Obsidian Vault — entry point. Boots the canvas, runs the fixed-step
// loop, owns the screen state machine (title / play / pause / level clear /
// win / game over), wires input and sound, and stages screenshot scenes
// when the page is opened with ?shot=start|play|stealth|end&seed=N.
import { BEST_KEY, FIELD, LEVELS, STEP } from './config.js';
import { createInput } from './input.js';
import { createWorld, resetWorld, stepWorld, EVENT_ALERT, EVENT_DOOR, EVENT_LOSE, EVENT_PICKED, EVENT_SMOKE, EVENT_STAR, EVENT_WIN } from './world.js';
import {
  SCREEN_LEVELDONE, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
  draw, drawButton, endButtonRect, titleButtonRect,
} from './render.js';
import { stageShot } from './shots.js';
import {
  isMuted, setMuted, sfxAlert, sfxClick, sfxDoor, sfxLose, sfxPickup, sfxSmoke, sfxStar, sfxWin,
  startAlarmLoop, stopAlarmLoop,
} from './audio.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? '7') || 7;

let levelIndex = 0;
let world = createWorld(levelIndex, seed);
let screen = SCREEN_TITLE;
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
} catch {
  best = 0;
}
let walkTarget = null;
let stuckTimer = 0;
let lastPos = { x: world.player.x, y: world.player.y };
let alarmLoopOn = false;

const input = createInput(canvas);

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch { /* storage unavailable */ }
  }
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = FIELD.width * dpr;
  canvas.height = FIELD.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function pointInRect(p, r) {
  return p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function handleEvents(events) {
  if (events & EVENT_PICKED) sfxPickup();
  if (events & EVENT_STAR) sfxStar();
  if (events & EVENT_ALERT) sfxAlert();
  if (events & EVENT_SMOKE) sfxSmoke();
  if (events & EVENT_DOOR) sfxDoor();
  if (events & EVENT_WIN) sfxWin();
  if (events & EVENT_LOSE) sfxLose();
  if (world.status === 'win' || world.status === 'leveldone') saveBest();
}

function startLevel(index) {
  // Advancing a wing keeps the score; a fresh game (wing 0) starts at 0.
  const keep = index === 0 ? 0 : world.score;
  levelIndex = index;
  world = createWorld(levelIndex, seed);
  world.score = keep;
  walkTarget = null;
  screen = SCREEN_PLAY;
  setStatus(`${LEVELS[levelIndex].name}. Steal the Obsidian Star and escape.`);
}

function startGame() {
  sfxClick();
  startLevel(0);
}

function retryLevel() {
  // Restart the current wing, keeping the score earned on earlier wings.
  const score = world.score - world.lootValue;
  world = createWorld(levelIndex, seed);
  world.score = Math.max(0, score);
  walkTarget = null;
  screen = SCREEN_PLAY;
  setStatus(`${LEVELS[levelIndex].name}. Steal the Obsidian Star and escape.`);
}

function advanceAfterEnd() {
  sfxClick();
  if (world.status === 'leveldone') {
    startLevel(levelIndex + 1);
  } else if (world.status === 'win') {
    startLevel(0);
  } else {
    // Caught or out of time: retry this wing, not the whole heist.
    retryLevel();
  }
}

function togglePause() {
  if (screen === SCREEN_PLAY) {
    screen = SCREEN_PAUSE;
    setStatus('Paused.');
  } else if (screen === SCREEN_PAUSE) {
    screen = SCREEN_PLAY;
    setStatus('Playing.');
  }
}

function step(dt) {
  // One-shot keys.
  if (input.wasPressed('p') || input.wasPressed('Escape')) togglePause();
  if (input.wasPressed('m')) setMuted(!isMuted());
  if (input.wasPressed('r') && (screen === SCREEN_PLAY || screen === SCREEN_OVER)) {
    retryLevel();
  }
  if (input.wasPressed('Enter')) {
    if (screen === SCREEN_TITLE) startGame();
    else if (screen === SCREEN_LEVELDONE || screen === SCREEN_WIN || screen === SCREEN_OVER) advanceAfterEnd();
    else if (screen === SCREEN_PAUSE) togglePause();
  }

  // Clicks: buttons first, otherwise a walk target.
  const click = input.takeClick();
  if (click) {
    if (screen === SCREEN_TITLE && pointInRect(click, titleButtonRect())) {
      startGame();
    } else if (
      (screen === SCREEN_LEVELDONE || screen === SCREEN_WIN || screen === SCREEN_OVER || screen === SCREEN_PAUSE) &&
      pointInRect(click, endButtonRect())
    ) {
      if (screen === SCREEN_PAUSE) togglePause();
      else advanceAfterEnd();
    } else if (screen === SCREEN_PLAY) {
      walkTarget = { x: click.x, y: click.y };
    }
  }

  if (screen !== SCREEN_PLAY) {
    input.consumePressed();
    return;
  }

  // Movement: keys win over click-to-move.
  const keys = input.moveVector();
  let move = { x: 0, y: 0 };
  if (keys.active) {
    move = { x: keys.x, y: keys.y };
    walkTarget = null;
  } else if (walkTarget) {
    const dx = walkTarget.x - world.player.x;
    const dy = walkTarget.y - world.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) {
      walkTarget = null;
    } else {
      move = { x: dx / dist, y: dy / dist };
      // Stuck against a wall: give up on this target after a second.
      if (Math.hypot(world.player.x - lastPos.x, world.player.y - lastPos.y) < 0.5 && world.player.moving) {
        stuckTimer += dt;
        if (stuckTimer > 1) {
          walkTarget = null;
          stuckTimer = 0;
        }
      } else {
        stuckTimer = 0;
      }
      lastPos = { x: world.player.x, y: world.player.y };
    }
  }

  const useSmoke = input.wasPressed(' ') || input.wasPressed('e');
  const events = stepWorld(world, dt, move, input.sneaking(), useSmoke);
  handleEvents(events);

  // Alarm siren loop while the alarm is high.
  if (world.alarm > 70 && !alarmLoopOn) {
    startAlarmLoop();
    alarmLoopOn = true;
  } else if (world.alarm <= 60 && alarmLoopOn) {
    stopAlarmLoop();
    alarmLoopOn = false;
  }

  if (world.status === 'leveldone') {
    screen = SCREEN_LEVELDONE;
    setStatus(`Level clear! Score ${world.score}.`);
  } else if (world.status === 'win') {
    screen = SCREEN_WIN;
    setStatus(`Clean getaway! Final score ${world.score}.`);
  } else if (world.status === 'caught' || world.status === 'timeout') {
    screen = SCREEN_OVER;
    setStatus(world.statusReason);
  } else if (world.spotted) {
    setStatus(`Spotted! Alarm ${Math.round(world.alarm)}%. Break line of sight!`);
  } else if (world.starTaken) {
    setStatus('Star secured! Get to the green EXIT door.');
  }

  input.consumePressed();
}

// --- Screenshot mode: stage one deterministic scene and draw it once. ---
if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  draw(ctx, world, screen, best, world.time);
  setStatus(`Screenshot scene: ${shotName}. Score ${world.score}, alarm ${Math.round(world.alarm)}%.`);
  window.__game = { world, screen, seed, shot: shotName };
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    draw(ctx, world, screen, best, world.time);
    requestAnimationFrame(frame);
  }
  setStatus('The Obsidian Vault. Press Enter or click Start the Heist.');
  window.__game = { get world() { return world; }, get screen() { return screen; }, seed };
  requestAnimationFrame(frame);
}
