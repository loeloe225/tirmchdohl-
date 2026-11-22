// The Obsidian Vault — a midnight heist. Original game, original art, original sounds.
// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule depends on screen size.

export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60; // fixed simulation step, 60 updates a second

export const PLAYER = {
  radius: 13,
  walkSpeed: 195,
  sneakSpeed: 100,
  // Hearing radius while walking (sneaking is silent).
  hearRadius: 95,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 68,
  chaseSpeed: 152,
  viewRange: 265,
  viewHalfAngle: 0.56, // ~32 degrees each side
  spotRate: 58, // alarm points per second while fully seen by a guard
  chaseTime: 3.0,
  returnSpeed: 85,
};

export const CAMERA = {
  viewRange: 245,
  viewHalfAngle: 0.5,
  spotRate: 42,
  sweepSpeed: 0.55, // radians per second
};

export const ALARM = {
  decay: 6, // points per second while unseen
  hearRate: 9, // points per second while heard walking near a guard
  max: 100,
};

export const SMOKE = { radius: 95, seconds: 4, perLevel: 2 };

export const STAR_VALUE = 1000;
export const TIME_BONUS_PER_SECOND = 10;
export const ALARM_BONUS_PER_POINT = 5;

export const PALETTE = {
  floorA: '#1d212b',
  floorB: '#20242f',
  carpet: '#5a1f2b',
  carpetEdge: '#8a6d2f',
  wall: '#0e1016',
  wallTrim: '#c9a227',
  caseGlass: '#3d5a74',
  caseFrame: '#7a5c1e',
  painting: '#7a4a2b',
  text: '#f2ead8',
  muted: '#9aa3b2',
  panel: 'rgba(12, 14, 20, 0.88)',
  player: '#e8e4d8',
  playerCoat: '#23252e',
  guard: '#2e4a7a',
  guardAlert: '#c0392b',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneAlert: 'rgba(231, 76, 60, 0.30)',
  camera: '#b03a2e',
  cameraCone: 'rgba(231, 76, 60, 0.16)',
  loot: '#f2c94c',
  star: '#7fe7ff',
  exit: '#2ecc71',
  exitLocked: '#7f8c8d',
  smoke: 'rgba(200, 205, 215, 0.35)',
  alarmLow: '#2ecc71',
  alarmMid: '#f39c12',
  alarmHigh: '#e74c3c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const BEST_KEY = 'obsidian-vault.best';

// --- Level layouts ---------------------------------------------------------
// Walls are {x, y, w, h} rectangles. Guards patrol between waypoints.
// Cameras sit on a wall point and sweep around a base angle.
// Loot: {x, y, kind, value, label}. kind 'star' is the required target.

function loot(x, y, kind, value, label) {
  return { x, y, kind, value, label, taken: false };
}

export const LEVELS = [
  {
    name: 'Level 1 — The Gallery',
    time: 150,
    walls: [
      { x: 0, y: 0, w: 1280, h: 18 }, { x: 0, y: 702, w: 1280, h: 18 },
      { x: 0, y: 0, w: 18, h: 720 }, { x: 1262, y: 0, w: 18, h: 720 },
      { x: 300, y: 130, w: 220, h: 26 },
      { x: 760, y: 130, w: 220, h: 26 },
      { x: 300, y: 560, w: 220, h: 26 },
      { x: 760, y: 560, w: 220, h: 26 },
      { x: 600, y: 380, w: 80, h: 80 },
    ],
    cases: [
      { x: 380, y: 210, w: 70, h: 44 }, { x: 830, y: 210, w: 70, h: 44 },
      { x: 380, y: 470, w: 70, h: 44 }, { x: 830, y: 470, w: 70, h: 44 },
    ],
    guards: [
      { waypoints: [[180, 90], [640, 90], [640, 330], [180, 330]], phase: 0 },
      { waypoints: [[1100, 640], [700, 640], [700, 390], [1100, 390]], phase: 0.5 },
    ],
    cameras: [
      { x: 640, y: 20, baseAngle: Math.PI / 2, sweep: 0.9 },
      { x: 1244, y: 360, baseAngle: Math.PI, sweep: 0.8 },
    ],
    loot: [
      loot(1075, 360, 'star', STAR_VALUE, 'Obsidian Star'),
      loot(415, 232, 'gold', 150, 'Gold bar'),
      loot(865, 232, 'gold', 150, 'Gold bar'),
      loot(415, 492, 'painting', 200, 'Miniature'),
      loot(865, 492, 'painting', 200, 'Miniature'),
    ],
    start: { x: 90, y: 650 },
    exit: { x: 1195, y: 65, w: 52, h: 72 },
  },
  {
    name: 'Level 2 — The Vault Wing',
    time: 165,
    walls: [
      { x: 0, y: 0, w: 1280, h: 18 }, { x: 0, y: 702, w: 1280, h: 18 },
      { x: 0, y: 0, w: 18, h: 720 }, { x: 1262, y: 0, w: 18, h: 720 },
      { x: 220, y: 180, w: 26, h: 360 },
      { x: 540, y: 90, w: 200, h: 26 },
      { x: 540, y: 600, w: 200, h: 26 },
      { x: 860, y: 180, w: 26, h: 360 },
      { x: 1030, y: 90, w: 26, h: 200 },
      { x: 1030, y: 430, w: 26, h: 200 },
    ],
    cases: [
      { x: 620, y: 300, w: 70, h: 44 }, { x: 620, y: 420, w: 70, h: 44 },
      { x: 940, y: 300, w: 70, h: 44 },
    ],
    guards: [
      { waypoints: [[120, 100], [120, 620], [380, 620], [380, 100]], phase: 0 },
      { waypoints: [[640, 340], [820, 340], [820, 560], [640, 560]], phase: 0.33 },
      { waypoints: [[1150, 120], [1150, 620]], phase: 0.66 },
    ],
    cameras: [
      { x: 640, y: 20, baseAngle: Math.PI / 2, sweep: 1.0 },
      { x: 36, y: 360, baseAngle: 0, sweep: 0.9 },
      { x: 1244, y: 360, baseAngle: Math.PI, sweep: 0.9 },
    ],
    loot: [
      loot(655, 322, 'star', STAR_VALUE, 'Obsidian Star'),
      loot(655, 442, 'gold', 150, 'Gold bar'),
      loot(975, 322, 'gold', 150, 'Gold bar'),
      loot(320, 360, 'painting', 250, 'Portrait'),
      loot(1150, 360, 'jewel', 300, 'Jade cat'),
      loot(640, 130, 'gold', 150, 'Gold bar'),
    ],
    start: { x: 90, y: 650 },
    exit: { x: 1195, y: 65, w: 52, h: 72 },
  },
  {
    name: 'Level 3 — The Crown Chamber',
    time: 180,
    walls: [
      { x: 0, y: 0, w: 1280, h: 18 }, { x: 0, y: 702, w: 1280, h: 18 },
      { x: 0, y: 0, w: 18, h: 720 }, { x: 1262, y: 0, w: 18, h: 720 },
      { x: 280, y: 120, w: 26, h: 240 },
      { x: 280, y: 480, w: 26, h: 120 },
      { x: 740, y: 120, w: 26, h: 240 },
      { x: 740, y: 480, w: 26, h: 120 },
      { x: 480, y: 330, w: 320, h: 26 },
      { x: 980, y: 200, w: 200, h: 26 },
      { x: 980, y: 500, w: 200, h: 26 },
    ],
    cases: [
      { x: 560, y: 200, w: 70, h: 44 }, { x: 640, y: 470, w: 70, h: 44 },
      { x: 1040, y: 300, w: 70, h: 44 },
    ],
    guards: [
      { waypoints: [[140, 100], [140, 620], [420, 620], [420, 100]], phase: 0 },
      { waypoints: [[560, 100], [560, 260], [700, 260], [700, 100]], phase: 0.25 },
      { waypoints: [[900, 620], [640, 620], [640, 460], [900, 460]], phase: 0.5 },
      { waypoints: [[1220, 100], [1220, 620]], phase: 0.75 },
    ],
    cameras: [
      { x: 640, y: 20, baseAngle: Math.PI / 2, sweep: 1.1 },
      { x: 36, y: 200, baseAngle: 0, sweep: 0.9 },
      { x: 36, y: 520, baseAngle: 0, sweep: 0.9 },
      { x: 1244, y: 360, baseAngle: Math.PI, sweep: 1.0 },
    ],
    loot: [
      loot(640, 290, 'star', STAR_VALUE, 'Obsidian Star'),
      loot(595, 222, 'gold', 150, 'Gold bar'),
      loot(675, 492, 'gold', 150, 'Gold bar'),
      loot(1075, 322, 'jewel', 300, 'Jade cat'),
      loot(160, 360, 'painting', 250, 'Portrait'),
      loot(1080, 130, 'gold', 150, 'Gold bar'),
      loot(1080, 590, 'painting', 250, 'Landscape'),
    ],
    start: { x: 90, y: 650 },
    exit: { x: 1195, y: 65, w: 52, h: 72 },
  },
];
