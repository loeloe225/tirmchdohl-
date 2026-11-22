// The Obsidian Vault — rendering. Canvas 2D, everything drawn in code:
// no images, no fonts, no network requests. The playfield is 1280x720 and
// the canvas is scaled to fit the window, keeping the aspect ratio.
import { ALARM, CAMERA, FIELD, GUARD, PALETTE, FONT } from './config.js';
import { conePolygon } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELDONE = 'leveldone';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';
export const SCREEN_PAUSE = 'pause';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawStar(ctx, x, y, r, color, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.8, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.8, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function alarmColor(alarm) {
  if (alarm < 40) return PALETTE.alarmLow;
  if (alarm < 75) return PALETTE.alarmMid;
  return PALETTE.alarmHigh;
}

function drawWorld(ctx, state, time) {
  const level = state.level;
  // Floor tiles.
  for (let ty = 0; ty < 720; ty += 64) {
    for (let tx = 0; tx < 1280; tx += 64) {
      const even = ((tx + ty) / 64) % 2 === 0;
      ctx.fillStyle = even ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(tx, ty, 64, 64);
    }
  }
  // Carpet runner down the middle of the hall.
  ctx.fillStyle = PALETTE.carpet;
  ctx.fillRect(600, 18, 80, 684);
  ctx.fillStyle = PALETTE.carpetEdge;
  ctx.fillRect(596, 18, 4, 684);
  ctx.fillRect(680, 18, 4, 684);
  ctx.fillStyle = 'rgba(201, 162, 39, 0.35)';
  for (let y = 60; y < 700; y += 80) {
    ctx.beginPath();
    ctx.arc(640, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Display cases.
  for (const c of level.cases) {
    ctx.fillStyle = PALETTE.caseFrame;
    ctx.fillRect(c.x - 4, c.y - 4, c.w + 8, c.h + 8);
    ctx.fillStyle = PALETTE.caseGlass;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(c.x + 6, c.y + 5, c.w - 20, 5);
  }

  // Wall paintings (decorative).
  const paintings = [
    { x: 90, y: 26, w: 64, h: 40 }, { x: 1120, y: 26, w: 64, h: 40 },
    { x: 90, y: 652, w: 64, h: 40 }, { x: 1120, y: 652, w: 64, h: 40 },
  ];
  for (const p of paintings) {
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
    ctx.fillStyle = PALETTE.painting;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(242, 201, 76, 0.6)';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Exit door.
  const e = level.exit;
  const open = state.starTaken;
  ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#0e1016';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2 - 2);
  ctx.font = `11px ${FONT}`;
  ctx.fillText(open ? 'OPEN' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2 + 14);
  if (!open) {
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(e.x + e.w / 2 - 5, e.y + e.h / 2 + 20, 10, 12);
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y + e.h / 2 + 20, 6, Math.PI, 0);
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Loot.
  for (const item of level.loot) {
    if (item.taken) continue;
    const pulse = 1 + Math.sin(time * 3 + item.x) * 0.12;
    if (item.kind === 'star') {
      ctx.save();
      ctx.shadowColor = '#7fe7ff';
      ctx.shadowBlur = 22;
      drawStar(ctx, item.x, item.y, 26 * pulse, PALETTE.star, time * 0.4);
      ctx.restore();
      ctx.fillStyle = '#0e1016';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('★ OBSIDIAN STAR ★', item.x, item.y - 38);
    } else if (item.kind === 'gold') {
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(item.x - 11, item.y - 7, 22, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(item.x - 11, item.y - 7, 22, 4);
    } else if (item.kind === 'jewel') {
      ctx.save();
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 12;
      drawDiamond(ctx, item.x, item.y, 13 * pulse, '#2ecc71');
      ctx.restore();
    } else {
      // painting loot
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(item.x - 16, item.y - 12, 32, 24);
      ctx.fillStyle = PALETTE.painting;
      ctx.fillRect(item.x - 13, item.y - 9, 26, 18);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Smoke clouds (drawn over cones, under people).
  for (const s of state.smokes) {
    ctx.fillStyle = PALETTE.smoke;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220,225,235,0.25)';
    ctx.beginPath();
    ctx.arc(s.x - 20, s.y + 12, s.r * 0.55, 0, Math.PI * 2);
    ctx.arc(s.x + 24, s.y - 10, s.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vision cones.
  for (const g of state.guards) {
    const pts = conePolygon(g.x, g.y, g.facing, GUARD.viewRange, GUARD.viewHalfAngle, level.walls);
    drawCone(ctx, pts, g.alerted || g.mode === 'chase' ? PALETTE.coneAlert : PALETTE.cone);
  }
  for (const cam of state.cameras) {
    const pts = conePolygon(cam.x, cam.y, cam.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, level.walls);
    drawCone(ctx, pts, cam.alerted ? PALETTE.coneAlert : PALETTE.cameraCone);
  }

  // Cameras (wall mounts).
  for (const cam of state.cameras) {
    ctx.fillStyle = '#1a1d26';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cam.alerted ? '#ff3b30' : PALETTE.camera;
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.angle) * 3, cam.y + Math.sin(cam.angle) * 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ead8';
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = 'center';
    const labelX = Math.max(24, Math.min(FIELD.width - 24, cam.x));
    const labelY = cam.y < 44 ? cam.y + 38 : cam.y - 18; // stay below the HUD bar
    ctx.fillText('CAM', labelX, labelY);
  }

  // Guards.
  for (const g of state.guards) {
    ctx.fillStyle = g.alerted || g.mode === 'chase' ? PALETTE.guardAlert : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Cap + facing tick.
    ctx.fillStyle = '#0e1016';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2ead8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.facing) * 20, g.y + Math.sin(g.facing) * 20);
    ctx.stroke();
    // Suspicion arc.
    if (g.suspicion > 0.05) {
      ctx.strokeStyle = g.suspicion > 0.55 ? '#e74c3c' : '#f2c94c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.x, g.y, GUARD.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.suspicion);
      ctx.stroke();
    }
    if (g.alerted || g.mode === 'chase') {
      ctx.fillStyle = '#ff3b30';
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - GUARD.radius - 8);
    }
  }

  // Player — Rook, the thief in black with a pale mask.
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerCoat;
  ctx.beginPath();
  ctx.arc(0, 0, p.sneaking ? 11 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.player;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Mask band.
  ctx.fillStyle = PALETTE.player;
  ctx.fillRect(-9, -4, 18, 7);
  ctx.fillStyle = '#0e1016';
  ctx.beginPath();
  ctx.arc(-4, -1, 1.8, 0, Math.PI * 2);
  ctx.arc(4, -1, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.strokeStyle = PALETTE.player;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.facing) * 18, Math.sin(p.facing) * 18);
  ctx.stroke();
  ctx.restore();
  if (p.sneaking) {
    ctx.fillStyle = '#9aa3b2';
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('sneaking…', p.x, p.y + 28);
  }

  // Walls on top (so cones and people never draw over them).
  for (const w of level.walls) {
    ctx.fillStyle = '#181c27';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
  }
}

function drawHud(ctx, state) {
  const level = state.level;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 0, FIELD.width, 52);
  ctx.fillStyle = PALETTE.wallTrim;
  ctx.fillRect(0, 52, FIELD.width, 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(level.name, 16, 22);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(`Loot $${state.lootValue}  •  ${state.lootTaken}/${state.lootTotal} items  •  Score ${state.score}`, 16, 42);

  // Alarm meter (centre).
  const ax = 470;
  const aw = 340;
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax, 20);
  ctx.fillStyle = '#0e1016';
  roundRect(ctx, ax, 26, aw, 16, 4);
  ctx.fill();
  ctx.fillStyle = alarmColor(state.alarm);
  if (state.alarm > 0.5) {
    roundRect(ctx, ax + 2, 28, Math.max(6, (aw - 4) * (state.alarm / ALARM.max)), 12, 3);
    ctx.fill();
  }
  ctx.fillStyle = state.spotted ? '#ff3b30' : PALETTE.muted;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(
    state.spotted ? `⚠ SPOTTED by ${state.seenBy === 'guard' ? 'GUARD' : 'CAMERA'}!` : `${Math.round(state.alarm)}%`,
    ax + aw + 12,
    40,
  );
  if (state.starTaken) {
    // Banner pill below the top bar (never over the ALARM label).
    const msg = '★ STAR SECURED — GET TO THE EXIT!';
    ctx.font = `bold 14px ${FONT}`;
    const mw = ctx.measureText(msg).width + 28;
    const bx = (FIELD.width - mw) / 2;
    ctx.fillStyle = 'rgba(12, 20, 28, 0.88)';
    roundRect(ctx, bx, 60, mw, 26, 13);
    ctx.fill();
    ctx.strokeStyle = PALETTE.star;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.star;
    ctx.textAlign = 'center';
    ctx.fillText(msg, FIELD.width / 2, 78);
  }

  // Right side: timer, smoke, star.
  ctx.textAlign = 'right';
  const mm = Math.floor(state.timeLeft / 60);
  const ss = Math.floor(state.timeLeft % 60).toString().padStart(2, '0');
  ctx.fillStyle = state.timeLeft < 30 ? '#ff3b30' : PALETTE.text;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(`${mm}:${ss}`, 1264, 24);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(`Smoke 💨 ×${state.smokeLeft}  •  ${state.starTaken ? '★ Star ✓' : '★ Star: steal it!'}`, 1264, 44);

  // Bottom hint bar.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 684, FIELD.width, 36);
  ctx.fillStyle = PALETTE.wallTrim;
  ctx.fillRect(0, 684, FIELD.width, 2);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    'WASD / arrows — move    •    Shift — sneak (silent)    •    Space — smoke bomb    •    Click — walk there    •    P — pause    •    M — mute    •    R — restart level',
    FIELD.width / 2,
    705,
  );
}

function drawPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 10, 15, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const w = 640;
  const h = 150 + lines.length * 30;
  const x = (FIELD.width - w) / 2;
  const y = (FIELD.height - h) / 2;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(title, FIELD.width / 2, y + 58);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `16px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, y + 100 + i * 30));
  return { x, y, w, h };
}

export function drawButton(ctx, rect, label, enabled = true) {
  ctx.fillStyle = enabled ? '#c9a227' : '#555';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#0e1016';
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 6);
  return rect;
}

export function titleButtonRect() {
  return { x: FIELD.width / 2 - 110, y: 470, w: 220, h: 52 };
}
export function endButtonRect() {
  return { x: FIELD.width / 2 - 110, y: 500, w: 220, h: 52 };
}

export function draw(ctx, state, screen, best, time) {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  drawWorld(ctx, state, time);
  drawHud(ctx, state);

  if (screen === SCREEN_TITLE) {
    // Dim the world a little so the title reads, but keep the room visible.
    ctx.fillStyle = 'rgba(8, 10, 15, 0.32)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const panel = drawPanel(
      ctx,
      'THE OBSIDIAN VAULT',
      [
        'Midnight at the Grand Meridian Museum. You are Rook, the thief.',
        'Steal the Obsidian Star, grab what you can, and slip out the EXIT',
        'before the alarm hits 100% or the guards change shift.',
        '',
        'Guards patrol with vision cones — cameras sweep the halls.',
        'Sneak (Shift) to stay quiet. Smoke (Space) breaks their sight.',
      ],
      '#c9a227',
    );
    void panel;
    drawButton(ctx, titleButtonRect(), '▶  START THE HEIST');
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`Best score: ${best}   •   WASD move, Shift sneak, Space smoke, click to walk`, FIELD.width / 2, 556);
  } else if (screen === SCREEN_LEVELDONE) {
    drawPanel(
      ctx,
      'LEVEL CLEAR!',
      [state.statusReason, `Score so far: ${state.score}`, '', 'Press Enter or click to enter the next wing.'],
      PALETTE.exit,
    );
    drawButton(ctx, endButtonRect(), 'NEXT LEVEL ▶');
  } else if (screen === SCREEN_WIN) {
    drawPanel(
      ctx,
      'CLEAN GETAWAY!',
      [
        state.statusReason,
        `Final score: ${state.score}   •   Loot: $${state.lootValue}`,
        `Best score: ${Math.max(best, state.score)}`,
        '',
        'The Obsidian Star is yours. The museum never saw you coming.',
      ],
      PALETTE.star,
    );
    drawButton(ctx, endButtonRect(), 'PLAY AGAIN');
  } else if (screen === SCREEN_OVER) {
    drawPanel(
      ctx,
      'BUSTED!',
      [state.statusReason, `Score: ${state.score}   •   Loot: $${state.lootValue}`, '', 'Press Enter, R, or click to try this wing again.'],
      '#e74c3c',
    );
    drawButton(ctx, endButtonRect(), 'TRY AGAIN');
  } else if (screen === SCREEN_PAUSE) {
    drawPanel(ctx, 'PAUSED', ['The museum waits. The guards do not.', '', 'Press P or click to resume.'], PALETTE.muted);
    drawButton(ctx, endButtonRect(), 'RESUME');
  }
}
