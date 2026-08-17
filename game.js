// Gnome Escape — Level 1
// Placeholder-shape rendering, vanilla JS, single-screen co-op puzzle-platformer.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

const GRAVITY = 0.55;
const MAX_FALL_SPEED = 13;
const FLOOR_Y = 500; // top surface of the main floor
const VOID_Y = H + 60; // falling past this resets the level

// ---------- Input ----------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.code);
  if (e.code === 'KeyR') resetLevel();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ---------- Helpers ----------
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------- Character art ----------
// Walk-cycle videos have a solid dark background; each frame is keyed out to alpha
// on the fly (against a background color sampled once from the first frame) so the
// live video content drops cleanly onto the level art.
const anims = {};
function setupAnim(key, src) {
  const video = document.createElement('video');
  video.src = src;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.style.position = 'absolute';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.width = 2;
  video.height = 2;
  document.body.appendChild(video);
  video.addEventListener('loadeddata', () => video.play().catch(() => {}));

  const off = document.createElement('canvas');
  off.width = 96;
  off.height = 96;
  // feetFrac: fraction of the frame height (from the top) where the character's feet sit.
  // The source video frames are padded, so the feet aren't at the very bottom edge — without
  // this the sprite is drawn floating above the floor. Calibrated from the first keyed frame.
  anims[key] = { video, off, octx: off.getContext('2d'), bgColor: null, moving: true, feetFrac: 0.9 };
}
setupAnim('stone', 'assets/stone-walk.mp4');
setupAnim('wind', 'assets/wind-walk.mp4');

// ---------- Level background art ----------
// Reference mockup for the enchanted-ruins look (stone/moss/wood); stretched to fill the
// canvas as ambient backdrop, dimmed so the (differently laid-out) interactive elements
// drawn on top stay the clear, readable layer.
const levelArt = new Image();
levelArt.src = 'assets/level-reference.jpg';

function getAnimatedFrame(kind) {
  const a = anims[kind];
  if (!a || a.video.readyState < 2) return null;
  const { video, off, octx } = a;
  octx.clearRect(0, 0, off.width, off.height);
  octx.drawImage(video, 0, 0, off.width, off.height);
  const imgData = octx.getImageData(0, 0, off.width, off.height);
  const data = imgData.data;
  const firstCalibration = !a.bgColor;
  if (!a.bgColor) a.bgColor = [data[0], data[1], data[2]];
  const [bgR, bgG, bgB] = a.bgColor;
  const threshold = 60;
  let maxOpaqueRow = -1;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - bgR, dg = data[i + 1] - bgG, db = data[i + 2] - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < threshold) {
      data[i + 3] = 0;
    } else if (dist < threshold + 25) {
      data[i + 3] = Math.round((255 * (dist - threshold)) / 25);
    } else if (firstCalibration) {
      maxOpaqueRow = Math.max(maxOpaqueRow, Math.floor(i / 4 / off.width));
    }
  }
  octx.putImageData(imgData, 0, 0);
  if (firstCalibration && maxOpaqueRow >= 0) {
    a.feetFrac = (maxOpaqueRow + 1) / off.height;
  }
  return off;
}

// ---------- Static geometry (floor segments / walls) ----------
const solids = [
  // start floor
  { x: 0, y: FLOOR_Y, w: 200, h: H - FLOOR_Y },
  // mid floor (section B, has the lever)
  { x: 340, y: FLOOR_Y, w: 180, h: H - FLOOR_Y },
  // section C floor (fan + exit)
  { x: 640, y: FLOOR_Y, w: 320, h: H - FLOOR_Y },
  // left wall
  { x: -20, y: 0, w: 20, h: H },
  // right wall
  { x: W, y: 0, w: 20, h: H },
];

// ---------- Water hazard (section between start and mid floor) ----------
const water = { x: 200, y: FLOOR_Y, w: 140, h: H - FLOOR_Y };

// ---------- Lever + Bridge (raised across the water once activated) ----------
const lever = { x: 400, y: FLOOR_Y - 34, w: 30, h: 34, activated: false };
// Top surface flush with FLOOR_Y so players walk onto it instead of hitting its edge like a wall.
const bridge = { x: water.x, y: FLOOR_Y, w: water.w, h: 18 };

// ---------- Timed platform (chasm between mid floor and section C) ----------
const chasm = { x: 520, y: FLOOR_Y, w: 120, h: H - FLOOR_Y }; // visual pit only
const timedPlatform = {
  // Top surface flush with FLOOR_Y for the same reason as the bridge above.
  x: 520, y: FLOOR_Y, w: 90, h: 20,
  minX: 520, maxX: 550, // travels so it reaches both ledges (520 -> 550, platform width 90 spans 520-610/610-700... )
  speed: 1.1, dir: 1,
};
// Recompute travel range so the platform can reach both the mid-floor edge (x=520 going left)
// and the section-C edge (x=640 going right), i.e. its right edge touches 640 at max.
timedPlatform.minX = 520 - 0; // left ledge edge
timedPlatform.maxX = 640 - timedPlatform.w; // so platform.x + w == 640 at max
timedPlatform.x = timedPlatform.minX;

// ---------- Fan zone (hazard for Stone, harmless for Wind) ----------
const fan = {
  x: 660, y: 280, w: 90, h: FLOOR_Y - 280,
  cycleOn: 2000, cycleOff: 1500, timer: 0, active: true,
};

// ---------- Pushable block + pressure plate + gate (Stone-only puzzle) ----------
// Only Stone Gnome is heavy enough to push the block; Wind Gnome is simply blocked by it.
const pushableBlock = { x: 770, y: FLOOR_Y - 40, w: 36, h: 40, startX: 770 };
const plate = { x: 850, y: FLOOR_Y - 6, w: 50, h: 6, activated: false };
const gate = { x: 905, y: 380, w: 16, h: FLOOR_Y - 380, open: false };

// ---------- Exit ----------
const exitZone = { x: 925, y: FLOOR_Y - 40, w: 32, h: 40 };

// ---------- Particles for fan gust visuals ----------
let particles = [];

// ---------- Player ----------
class Player {
  constructor(kind, x, y, controls, color) {
    this.kind = kind; // 'stone' | 'wind'
    this.startX = x;
    this.startY = y;
    this.w = 34;
    this.h = 42;
    this.controls = controls;
    this.color = color;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.jumpsUsed = 0;
    this.dead = false;
    this.facing = 1;
  }

  get maxJumps() {
    return this.kind === 'wind' ? 2 : 1;
  }

  update() {
    const moveSpeed = 3.4;
    let left = keys.has(this.controls.left);
    let right = keys.has(this.controls.right);
    let jumpPressed = keys.has(this.controls.jump);

    if (left && !right) {
      this.vx = -moveSpeed;
      this.facing = -1;
    } else if (right && !left) {
      this.vx = moveSpeed;
      this.facing = 1;
    } else {
      this.vx = 0;
    }

    const anim = anims[this.kind];
    if (anim) {
      const shouldMove = this.vx !== 0;
      if (shouldMove !== anim.moving) {
        anim.moving = shouldMove;
        if (shouldMove) anim.video.play().catch(() => {});
        else anim.video.pause();
      }
    }

    // Jump (with double-jump for Wind Gnome)
    if (jumpPressed && !this.jumpKeyLatch) {
      if (this.onGround || this.jumpsUsed < this.maxJumps) {
        this.vy = this.kind === 'wind' ? -10 : -11.5;
        this.jumpsUsed++;
        this.onGround = false;
      }
    }
    this.jumpKeyLatch = jumpPressed;

    // Wind Gnome glide: holding jump while falling slows descent
    let gravity = GRAVITY;
    if (this.kind === 'wind' && jumpPressed && this.vy > 0) {
      gravity *= 0.35;
    }

    // Fan gust forces
    const inFan = rectsOverlap(this.hitbox(), fan) && fan.active;
    if (inFan) {
      if (this.kind === 'stone') {
        this.vx -= 3.2; // gust pushes Stone backward (leftward)
      } else {
        this.vy -= 0.9; // updraft gently lifts Wind Gnome
      }
    }

    this.vy += gravity;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    if (this.kind === 'stone') this.pushBlockIfNeeded();

    // Move & collide X
    this.x += this.vx;
    this.resolveCollisions('x');

    // Move & collide Y
    this.y += this.vy;
    this.onGround = false;
    this.resolveCollisions('y');

    // Water: fatal for Stone Gnome, harmless for Wind Gnome
    if (this.kind === 'stone' && rectsOverlap(this.hitbox(), water) && !this.standingOnBridge()) {
      this.die('Stone Gnome sank in the water!');
    }

    // Fell into the void
    if (this.y > VOID_Y) {
      this.die('Fell too far!');
    }
  }

  pushBlockIfNeeded() {
    if (this.vx === 0) return;
    const nextBox = { x: this.x + this.vx, y: this.y, w: this.w, h: this.h };
    if (!rectsOverlap(nextBox, pushableBlock)) return;
    const pushingRight = this.vx > 0 && this.x + this.w <= pushableBlock.x + 1;
    const pushingLeft = this.vx < 0 && this.x >= pushableBlock.x + pushableBlock.w - 1;
    if (!pushingRight && !pushingLeft) return;

    const blockNext = { ...pushableBlock, x: pushableBlock.x + this.vx };
    // The gate always stops the block (even once open for the gnomes) so it can never be
    // shoved into the exit doorway and wall it off.
    const blockers = [...solids, gate];
    const hitWall = blockers.some((s) => rectsOverlap(blockNext, s));
    if (hitWall) {
      this.vx = 0;
    } else {
      pushableBlock.x = blockNext.x;
    }
  }

  standingOnBridge() {
    if (!lever.activated) return false;
    return rectsOverlap(this.hitbox(), { x: bridge.x, y: bridge.y - 4, w: bridge.w, h: bridge.h + 8 });
  }

  hitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  getSolids() {
    const list = [...solids];
    if (lever.activated) list.push(bridge);
    if (!gate.open) list.push(gate);
    list.push(timedPlatform, pushableBlock);
    return list;
  }

  resolveCollisions(axis) {
    const box = this.hitbox();
    for (const s of this.getSolids()) {
      if (!rectsOverlap(box, s)) continue;
      if (axis === 'x') {
        if (this.vx > 0) this.x = s.x - this.w;
        else if (this.vx < 0) this.x = s.x + s.w;
        this.vx = 0;
      } else {
        if (this.vy > 0) {
          this.y = s.y - this.h;
          this.vy = 0;
          this.onGround = true;
          this.jumpsUsed = 0;
          if (s === timedPlatform) this.ridingPlatform = true;
        } else if (this.vy < 0) {
          this.y = s.y + s.h;
          this.vy = 0;
        }
      }
      box.x = this.x;
      box.y = this.y;
    }
  }

  die(msg) {
    if (this.dead) return;
    this.dead = true;
    message = msg + ' Resetting...';
    messageTimer = 90;
    setTimeout(() => resetLevel(), 550);
  }

  draw() {
    const sprite = getAnimatedFrame(this.kind);
    if (!sprite) {
      // Fallback placeholder while the character video is still loading
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      return;
    }

    const drawW = 72;
    const drawH = 72;
    const cx = this.x + this.w / 2;
    // Anchor by where the character's feet actually sit in the source frame, not the
    // frame's bottom edge (which is padded), so the sprite doesn't float above the floor.
    const feetFrac = anims[this.kind].feetFrac;
    const topY = this.y + this.h - feetFrac * drawH;

    ctx.save();
    if (this.facing < 0) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, -drawW / 2, topY, drawW, drawH);
    } else {
      ctx.drawImage(sprite, cx - drawW / 2, topY, drawW, drawH);
    }
    ctx.restore();
  }
}

const stoneGnome = new Player(
  'stone', 40, FLOOR_Y - 42,
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW' },
  '#8b8378'
);
const windGnome = new Player(
  'wind', 90, FLOOR_Y - 42,
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp' },
  '#b6e8ff'
);
const players = [stoneGnome, windGnome];

// ---------- Level state ----------
let message = '';
let messageTimer = 0;
let levelComplete = false;
let lastTime = 0;

function resetLevel() {
  lever.activated = false;
  timedPlatform.x = timedPlatform.minX;
  timedPlatform.dir = 1;
  fan.timer = 0;
  fan.active = true;
  pushableBlock.x = pushableBlock.startX;
  plate.activated = false;
  gate.open = false;
  levelComplete = false;
  particles = [];
  for (const p of players) p.reset();
}

function updateLever() {
  if (lever.activated) return;
  for (const p of players) {
    if (rectsOverlap(p.hitbox(), lever)) {
      lever.activated = true;
      message = 'Bridge raised!';
      messageTimer = 90;
    }
  }
}

function updateTimedPlatform(dt) {
  const prevX = timedPlatform.x;
  timedPlatform.x += timedPlatform.speed * timedPlatform.dir * (dt / 16.67);
  if (timedPlatform.x >= timedPlatform.maxX) {
    timedPlatform.x = timedPlatform.maxX;
    timedPlatform.dir = -1;
  } else if (timedPlatform.x <= timedPlatform.minX) {
    timedPlatform.x = timedPlatform.minX;
    timedPlatform.dir = 1;
  }
  const delta = timedPlatform.x - prevX;
  // Carry riders along with the platform
  for (const p of players) {
    if (p.ridingPlatform) {
      p.x += delta;
    }
    p.ridingPlatform = false;
  }
}

function updatePlate() {
  if (plate.activated) return;
  if (rectsOverlap(pushableBlock, plate)) {
    plate.activated = true;
    gate.open = true;
    message = 'Gate opened!';
    messageTimer = 90;
  }
}

function updateFan(dt) {
  fan.timer += dt;
  const cycle = fan.active ? fan.cycleOn : fan.cycleOff;
  if (fan.timer >= cycle) {
    fan.timer = 0;
    fan.active = !fan.active;
  }
  if (fan.active && Math.random() < 0.3) {
    particles.push({
      x: fan.x + Math.random() * fan.w,
      y: fan.y + fan.h,
      vy: -(2 + Math.random() * 2),
      life: 40,
    });
  }
  particles.forEach((pt) => {
    pt.y += pt.vy;
    pt.life--;
  });
  particles = particles.filter((pt) => pt.life > 0 && pt.y > fan.y);
}

function updateExit() {
  const bothIn = players.every((p) => rectsOverlap(p.hitbox(), exitZone));
  if (bothIn && !levelComplete) {
    levelComplete = true;
    message = 'Level Complete!';
    messageTimer = 99999;
  }
}

// ---------- Drawing ----------
function drawBackground() {
  ctx.fillStyle = '#2c3a2a';
  ctx.fillRect(0, 0, W, H);

  if (levelArt.complete && levelArt.naturalWidth > 0) {
    ctx.drawImage(levelArt, 0, 0, W, H);
    ctx.fillStyle = 'rgba(15, 20, 12, 0.45)';
    ctx.fillRect(0, 0, W, H);
  } else {
    // decorative overgrowth stripes while the backdrop art is still loading
    ctx.fillStyle = '#243424';
    for (let i = 0; i < W; i += 40) {
      ctx.fillRect(i, 0, 2, H);
    }
  }
}

function drawSolids() {
  for (const s of solids) {
    ctx.fillStyle = '#6b6f63';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#5a7a3a';
    ctx.fillRect(s.x, s.y, s.w, 7);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let cx = s.x + 6; cx < s.x + s.w; cx += 22) {
      ctx.fillRect(cx, s.y + 10, 3, s.h - 14);
    }
  }
}

function drawWater() {
  ctx.fillStyle = 'rgba(60, 130, 200, 0.75)';
  ctx.fillRect(water.x, water.y, water.w, water.h);
  ctx.fillStyle = 'rgba(150, 210, 255, 0.6)';
  const t = Date.now() / 300;
  for (let x = water.x; x < water.x + water.w; x += 16) {
    const wob = Math.sin(t + x) * 2;
    ctx.fillRect(x, water.y + 4 + wob, 10, 3);
  }
}

function drawChasm() {
  ctx.fillStyle = '#0e0d0a';
  ctx.fillRect(chasm.x, chasm.y, chasm.w, chasm.h);
}

function drawLever() {
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(lever.x, lever.y + lever.h - 10, lever.w, 10);
  ctx.fillStyle = '#5c5648';
  ctx.fillRect(lever.x + lever.w / 2 - 4, lever.y, 8, lever.h - 8);
  ctx.fillStyle = lever.activated ? '#7fd47f' : '#8a3a2a';
  ctx.beginPath();
  ctx.arc(lever.x + lever.w / 2, lever.y + (lever.activated ? 4 : lever.h - 12), 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawBridge() {
  if (!lever.activated) return;
  ctx.fillStyle = '#7a6440';
  ctx.fillRect(bridge.x, bridge.y, bridge.w, bridge.h);
  ctx.fillStyle = '#93794f';
  for (let x = bridge.x; x < bridge.x + bridge.w; x += 18) {
    ctx.fillRect(x, bridge.y, 4, bridge.h);
  }
}

function drawTimedPlatform() {
  ctx.fillStyle = '#c07a3a';
  ctx.fillRect(timedPlatform.x, timedPlatform.y, timedPlatform.w, timedPlatform.h);
  ctx.fillStyle = '#e0995a';
  ctx.fillRect(timedPlatform.x, timedPlatform.y, timedPlatform.w, 4);
}

function drawFan() {
  ctx.fillStyle = fan.active ? 'rgba(180, 150, 230, 0.28)' : 'rgba(120, 110, 120, 0.12)';
  ctx.fillRect(fan.x, fan.y, fan.w, fan.h);
  ctx.strokeStyle = fan.active ? '#b8a0e0' : '#555';
  ctx.strokeRect(fan.x, fan.y, fan.w, fan.h);

  ctx.fillStyle = '#d8c8f0';
  for (const pt of particles) {
    ctx.fillRect(pt.x, pt.y, 3, 8);
  }

  ctx.fillStyle = fan.active ? '#e0d0ff' : '#888';
  ctx.font = '12px monospace';
  ctx.fillText(fan.active ? 'GUST' : 'calm', fan.x + fan.w / 2 - 16, fan.y - 8);
}

function drawPlate() {
  ctx.fillStyle = plate.activated ? '#7fd47f' : '#9a8f6f';
  ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  ctx.strokeStyle = '#4a4433';
  ctx.strokeRect(plate.x, plate.y, plate.w, plate.h);
}

function drawBlock() {
  ctx.fillStyle = '#7a746c';
  ctx.fillRect(pushableBlock.x, pushableBlock.y, pushableBlock.w, pushableBlock.h);
  ctx.strokeStyle = '#4a463f';
  ctx.strokeRect(pushableBlock.x, pushableBlock.y, pushableBlock.w, pushableBlock.h);
  ctx.strokeStyle = '#5c574e';
  ctx.beginPath();
  ctx.moveTo(pushableBlock.x, pushableBlock.y);
  ctx.lineTo(pushableBlock.x + pushableBlock.w, pushableBlock.y + pushableBlock.h);
  ctx.moveTo(pushableBlock.x + pushableBlock.w, pushableBlock.y);
  ctx.lineTo(pushableBlock.x, pushableBlock.y + pushableBlock.h);
  ctx.stroke();
}

function drawGate() {
  if (gate.open) return;
  ctx.fillStyle = '#3f4a3f';
  ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
  ctx.fillStyle = '#5c6b5c';
  ctx.fillRect(gate.x, gate.y, gate.w, 6);
}

function drawExit() {
  const glow = levelComplete ? 1 : 0.6 + Math.sin(Date.now() / 200) * 0.2;
  ctx.fillStyle = `rgba(212, 178, 63, ${glow})`;
  ctx.fillRect(exitZone.x, exitZone.y, exitZone.w, exitZone.h);
  ctx.strokeStyle = '#f5e2a0';
  ctx.strokeRect(exitZone.x, exitZone.y, exitZone.w, exitZone.h);
}

function drawMessage() {
  if (messageTimer <= 0) return;
  messageTimer--;
  ctx.fillStyle = levelComplete ? '#d4b23f' : '#e7dcc3';
  ctx.font = levelComplete ? 'bold 32px monospace' : 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(message, W / 2, levelComplete ? H / 2 : 30);
  ctx.textAlign = 'left';
}

// ---------- Main loop ----------
function loop(time) {
  const dt = lastTime ? Math.min(time - lastTime, 50) : 16.67;
  lastTime = time;

  if (!levelComplete) {
    updateLever();
    updateTimedPlatform(dt);
    updateFan(dt);
    for (const p of players) p.update();
    updatePlate();
    updateExit();
  }

  drawBackground();
  drawChasm();
  drawWater();
  drawSolids();
  drawBridge();
  drawTimedPlatform();
  drawLever();
  drawFan();
  drawPlate();
  drawBlock();
  drawGate();
  drawExit();
  for (const p of players) p.draw();
  drawMessage();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
