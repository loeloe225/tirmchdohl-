// Keyboard + mouse input. Movement keys, sneak, smoke bomb, pause, mute,
// restart. Mouse click sets a walk target (click-to-move) and clicks UI buttons.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, consumed by the game each step
  let clickTarget = null; // {x, y} in logical field coordinates, or null
  let clickPoint = null; // raw click for UI hit-testing, consumed by the game

  function keyOf(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyOf(e)));
  window.addEventListener('blur', () => {
    keys.clear();
    clickTarget = null;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    clickPoint = { x, y };
    clickTarget = { x, y };
  });

  function moveVector() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) x += 1;
    if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y, active: x !== 0 || y !== 0 };
  }

  return {
    keys,
    moveVector,
    sneaking() {
      return keys.has('Shift');
    },
    wasPressed(k) {
      return pressed.has(k);
    },
    consumePressed() {
      pressed.clear();
    },
    getClickTarget() {
      return clickTarget;
    },
    clearClickTarget() {
      clickTarget = null;
    },
    takeClick() {
      const c = clickPoint;
      clickPoint = null;
      return c;
    },
  };
}
