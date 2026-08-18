// Gnome Escape — tile-grid engine, level loader, and palette renderer.
// Built to the design handoff in `updated assets/`: 24px tiles, 20x12 rooms, a 480x288
// internal buffer presented at an integer scale, and the locked 18-colour ink/haze/signal
// palette. See gnome-escape-design.md and the handoff README for the full spec.

// ---------- Palette (palette.json, inlined) ----------
const PALETTE = {
  ink: { void: '#14131f', body: '#1f1e2e', facet: '#2e2c42', detail: '#45415d' },
  haze: { light: '#f2e7d3', near: '#e2d3ba', far: '#c9b79b', recess: '#a8967d' },
  signal: {
    water: ['#8fd9e4', '#4fb0c6'],
    gust: ['#efe6ff', '#cdbcff'],
    interactive: ['#ffe6a3', '#f0b64e'],
    stoneGnome: ['#f5c99b', '#d98c53'],
    windGnome: ['#dffff0', '#7fe0b0'],
  },
};

const HAZE_PER_ROOM = {
  1: ['#f2e7d3', '#e2d3ba', '#c9b79b', '#a8967d'],
  2: ['#eae4d8', '#d5cfc3', '#b8b2a6', '#96918a'],
  3: ['#e6f0e8', '#cfe0dc', '#b0c6c4', '#8fa5a6'],
  4: ['#f0e2de', '#ddc7c6', '#c0a7aa', '#9c868c'],
  5: ['#fbeecb', '#efdaa8', '#d7bd85', '#b39c69'],
  // Inverted per the Decisions section: deep indigo haze, the only room where this bends —
  // signal colours (water/gust/interactive/gnomes) still never change, only the ground.
  6: ['#3a3b57', '#2c2d44', '#212236', '#181927'],
};

// ---------- Grid / buffer dimensions ----------
const TILE = 24;
const ROOM_COLS = 20;
const ROOM_ROWS = 12;
const BUFFER_W = ROOM_COLS * TILE; // 480
const BUFFER_H = ROOM_ROWS * TILE; // 288
const SCALE = 2; // integer only: 2x -> 960x576

const canvas = document.getElementById('game');
canvas.width = BUFFER_W * SCALE;
canvas.height = BUFFER_H * SCALE;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// All drawing happens into this off-screen buffer at native tile-pixel resolution; it is
// blitted to the visible canvas, scaled by an integer factor, once per frame.
const buf = document.createElement('canvas');
buf.width = BUFFER_W;
buf.height = BUFFER_H;
const bctx = buf.getContext('2d');
bctx.imageSmoothingEnabled = false;

function colX(col) { return col * TILE; }
function rowY(row) { return row * TILE; }
// Inclusive tile range -> pixel span.
function span(a, b) { return (b - a + 1) * TILE; }

// ---------- Physics (tuned in buffer-pixel space; buffer is half the previous canvas'
// linear scale, so these are the prior build's constants halved to preserve the same feel) ----------
const GRAVITY = 0.275;
const MAX_FALL_SPEED = 6.5;
const MOVE_SPEED = 1.8;
const JUMP_V_STONE = -5.9;
const JUMP_V_WIND = -5.1;
const GLIDE_GRAVITY_SCALE = 0.35;
// Net of MOVE_SPEED, Stone should visibly labour through a gust but still make steady
// progress — a hazard to push through, not a wall. (-0.9 nets ~0.9 px/frame, half speed.)
const GUST_PUSH_STONE = -0.9;
const UPDRAFT_RISE_WIND = 4.4;
const UPDRAFT_SHOVE_STONE = -0.6;
const VOID_Y = BUFFER_H + 40;

// ---------- Input ----------
// `keys` (held state, checked every frame) drives gameplay movement. Menu navigation is
// discrete instead — handled directly in the keydown callback below, gated by gameState so
// it never fires during actual play.
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.code);

  if (gameState === 'title') {
    if (e.code === 'Enter' || e.code === 'Space') enterTower();
    return;
  }
  if (gameState === 'tower') {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') moveTowerSelection(1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') moveTowerSelection(-1);
    else if (e.code === 'Enter' || e.code === 'Space') startSelectedRoom();
    return;
  }
  if (gameState === 'playing') {
    if (e.code === 'KeyR') restartCurrentRoom();
    else if (e.code === 'Escape') pauseGame();
    return;
  }
  if (gameState === 'paused') {
    if (e.code === 'Escape') resumeGame();
    else if (e.code === 'KeyR') restartCurrentRoom();
    else if (e.code === 'KeyT') enterTower();
    return;
  }
  if (gameState === 'cleared') {
    if (e.code === 'Enter' || e.code === 'Space') advanceFromCleared();
    return;
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ---------- Helpers ----------
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ============================================================================
// Level data — tile coordinates, inclusive ranges. Same shape the design handoff
// uses for rooms 2-6 (see `updated assets/.../levels.json`); room 1 is authored here
// in the same format per the handoff's build instructions, trimmed to three beats
// (water + lever bridge + gust) per its Decisions section.
// ============================================================================
const ROOM_1 = {
  id: 1,
  name: 'Overgrown Ruins',
  floor: [
    { cols: [0, 4], rows: [10, 11] },
    { cols: [7, 19], rows: [10, 11] },
  ],
  elements: [
    { type: 'start', who: 'stone', col: 1, row: 9 },
    { type: 'start', who: 'wind', col: 2, row: 9 },
    { type: 'water', cols: [5, 6], rows: [10, 11] },
    { type: 'lever', col: 9, row: 9, raises: 'bridge', beat: 1 },
    { type: 'bridge', cols: [5, 6], row: 10, initiallyAbsent: true },
    { type: 'fanHousing', col: 15, row: 9, dir: 'right', id: 'fan1' },
    { type: 'gust', cols: [16, 19], row: 9, dir: 'right', source: 'fan1', beat: 2 },
    { type: 'exit', cols: [18, 19], rows: [8, 9] },
  ],
};

// Room 2 · The Cracked Vault — from design/levels.json, transcribed into this format.
// New: breakableWall (Stone-only, permanent), holdSwitch (recomputed from overlap every
// frame, not latched). Returns: pushBlock + plate.
const ROOM_2 = {
  id: 2,
  name: 'The Cracked Vault',
  floor: [{ cols: [0, 19], rows: [10, 11] }],
  elements: [
    { type: 'start', who: 'stone', col: 1, row: 9 },
    { type: 'start', who: 'wind', col: 2, row: 9 },
    { type: 'breakableWall', col: 6, rows: [5, 9] },
    { type: 'holdSwitch', col: 11, row: 9, opens: 'gate1' },
    { type: 'gate', id: 'gate1', col: 14, rows: [5, 9] },
    { type: 'pushBlock', col: 15, row: 9 },
    { type: 'plate', col: 17, row: 9, latches: 'gate1' },
    { type: 'exit', cols: [18, 19], rows: [8, 9] },
  ],
};

// Room 3 · Updraft Shaft — new: updraft column (lift for Wind, sideways shove for Stone),
// lever-spawned stepping stones. Returns: water, lever.
const ROOM_3 = {
  id: 3,
  name: 'Updraft Shaft',
  floor: [
    { cols: [0, 4], rows: [10, 11] },
    { cols: [11, 14], rows: [10, 11] },
    { cols: [15, 19], rows: [8, 11] },
  ],
  elements: [
    { type: 'start', who: 'stone', col: 1, row: 9 },
    { type: 'start', who: 'wind', col: 2, row: 9 },
    { type: 'water', cols: [5, 10], rows: [10, 11] },
    { type: 'fanHousing', col: 6, row: 9, dir: 'up', id: 'fan1' },
    // Bottom stops at row 8, not 9, so it doesn't reach down to stepping-stone/floor height —
    // Stone crossing on the stones shouldn't get shoved just for walking past underneath.
    { type: 'updraft', cols: [6, 7], rows: [4, 8] },
    { type: 'ledge', cols: [8, 12], row: 3 },
    { type: 'lever', col: 10, row: 2, spawns: 'steppingStones' },
    { type: 'steppingStones', cols: [5, 7, 9], row: 9, initiallyAbsent: true },
    { type: 'exit', cols: [17, 18], rows: [6, 7] },
  ],
};

// Room 4 · Brittle Causeway — new: brittle floor (breaks under Stone with a short warning,
// intact for Wind, restores on reset). Returns: timedPlatform, lever.
const ROOM_4 = {
  id: 4,
  name: 'Brittle Causeway',
  floor: [
    { cols: [0, 2], rows: [10, 11] },
    { cols: [3, 3], rows: [11, 11] }, // shallow 1-tile pit under the teaching slab — harmless
    { cols: [4, 4], rows: [10, 11] },
    { cols: [15, 19], rows: [10, 11] },
  ],
  elements: [
    { type: 'start', who: 'stone', col: 1, row: 9 },
    { type: 'start', who: 'wind', col: 2, row: 9 },
    { type: 'void', cols: [5, 14], rows: [10, 11] },
    { type: 'brittleFloor', col: 3, row: 10 }, // teaching slab: safe to break, tiny drop
    // row 8 (not 7): reachable by Wind's double jump without an updraft assist in this room,
    // while still needing a real double jump — a plain single jump falls short.
    { type: 'brittleFloor', cols: [5, 14], row: 8 },
    { type: 'lever', col: 16, row: 9, starts: 'timedPlatform' },
    { type: 'timedPlatform', widthTiles: 3, row: 10, travel: [5, 12] },
    { type: 'exit', cols: [18, 19], rows: [8, 9] },
  ],
};

// Room 5 · Crosswind Gallery — new: gust as traversal (Wind's only way across the void),
// and a pushable block as a windbreak (plugs a fan's mouth, killing its gust). Returns:
// bridge lever, plate. Ordering trap: plugging gust1 before Wind crosses stands it.
// Note: the source spec doesn't detail how either gnome climbs from the main floor up to
// the row-6 ledge/exit — added a two-step rise (col17) since nothing else provides it.
const ROOM_5 = {
  id: 5,
  name: 'Crosswind Gallery',
  floor: [
    { cols: [0, 7], rows: [10, 11] },
    { cols: [12, 19], rows: [10, 11] },
  ],
  elements: [
    { type: 'start', who: 'stone', col: 1, row: 9 },
    { type: 'start', who: 'wind', col: 2, row: 9 },
    { type: 'void', cols: [8, 11], rows: [10, 11] },
    { type: 'fanHousing', col: 6, row: 9, dir: 'right', id: 'fan1' },
    { type: 'gust', cols: [7, 11], row: 9, dir: 'right', source: 'fan1' },
    { type: 'lever', col: 5, row: 9, raises: 'bridge' },
    { type: 'bridge', cols: [8, 11], row: 10, initiallyAbsent: true },
    { type: 'pushBlock', col: 3, row: 9, id: 'block1' },
    // Lowered from the source spec's row 5/rows[4,5] to row 7/rows[6,7]: a single 48px jump
    // from the main floor onto the ledge, rather than a two-stage climb that (given this
    // room's jump physics) proved unreliable to land without a wider intermediate platform
    // than the room comfortably has space for.
    { type: 'fanHousing', col: 14, row: 7, dir: 'right', id: 'fan2' },
    { type: 'gust', cols: [15, 19], row: 7, dir: 'right', source: 'fan2' },
    { type: 'ledge', cols: [17, 19], row: 8 },
    { type: 'pushBlock', col: 13, row: 9, id: 'block2' },
    { type: 'plate', col: 16, row: 9, switchesOff: 'fan2' },
    { type: 'exit', cols: [18, 19], rows: [6, 7] },
  ],
};

// Room 6 · The Two Doors — finale. Introduces nothing new mechanically; combines everything
// plus paired exit doors (one per gnome, both occupied the same frame) in place of the
// shared pad. Floor is row 10 only here; row 11 is the tunnel band per the design doc.
// The "stair" (Decisions: cols[7,8], risesTo row 10) is built as a one-tile gap in the west
// floor at col7 that Stone climbs through from the tunnel below, rather than a literal
// multi-step shape — simpler, and the climb distance (24px) needs no ramp to be reliable.
const ROOM_6 = {
  id: 6,
  name: 'The Two Doors',
  floor: [
    { cols: [0, 1], rows: [10, 10] },
    { cols: [14, 19], rows: [10, 10] },
    // Tunnel band (row 11) is only 24px tall — a standing hitbox already pokes 2px into row
    // 10, so nothing can walk the tunnel under a column that also has row-10 floor above it.
    // cols2-13 therefore carry no row-10 floor: open sky (and, at cols3-6, the water hazard)
    // above the tunnel, with solid floor resuming only at col0-1 (west) and col14 (east) —
    // Stone climbs up out of the tunnel right at each end to reach them.
    { cols: [2, 13], rows: [11, 11] },
  ],
  elements: [
    { type: 'start', who: 'wind', col: 1, row: 9 },
    { type: 'start', who: 'stone', col: 14, row: 9 },
    { type: 'water', cols: [3, 6], rows: [10, 10] },
    // Widened from the source spec's single tile (same lesson as room 5's step: too narrow
    // to land on reliably) but starting at col2, not col1 — col1 overlaps Wind's own spawn
    // hitbox, which guarantees an underside bonk on the very first jump before it can rise
    // above the ledge at all.
    { type: 'ledge', cols: [2, 4], row: 8, voffset: 12 },
    { type: 'ledge', cols: [4, 7], row: 5, voffset: 12 },
    // Lower segment stops at row 9 (bottom at y240, flush with the floor line elsewhere in
    // this codebase) so it doesn't reach into the tunnel band below at all — row 11 is where
    // Stone's whole route depends on passing under the pillar; even a couple of pixels of
    // segment poking into that band is enough to wall it off given the tunnel's tight
    // clearance (see the floor comment above).
    { type: 'pillar', col: 9, rows: [[0, 3], [6, 9]], windowRows: [4, 5], passableBy: 'wind' },
    { type: 'breakableWall', col: 13, rows: [5, 9] },
    { type: 'brittleFloor', cols: [14, 17], row: 7 },
    { type: 'exit', who: 'stone', cols: [0, 1], rows: [8, 9] },
    { type: 'exit', who: 'wind', cols: [18, 19], rows: [8, 9] },
  ],
};

const LEVELS = { 1: ROOM_1, 2: ROOM_2, 3: ROOM_3, 4: ROOM_4, 5: ROOM_5, 6: ROOM_6 };

// ============================================================================
// Room runtime state
// ============================================================================
let room = null;
let currentRoomId = 1;
let solids = []; // static floor rects
let dynamicSolids = []; // solids that appear/disappear (bridge, etc.)
let water = [];
let levers = [];
let bridges = [];
let gusts = [];
let fanHousings = [];
let exits = [];
let breakableWalls = [];
let holdSwitches = [];
let gates = [];
let pushBlocks = [];
let plates = [];
let updrafts = [];
let ledges = [];
let steppingStoneGroups = []; // { stones: [...], active }
let brittleTiles = [];
let timedPlatforms = [];
let voids = [];
let pillars = [];
let hazeColors = HAZE_PER_ROOM[1];

function findById(list, id) {
  return list.find((item) => item.id === id);
}

function buildRoom(def) {
  room = def;
  hazeColors = HAZE_PER_ROOM[def.id] || HAZE_PER_ROOM[1];

  solids = def.floor.map((f) => ({
    x: colX(f.cols[0]), y: rowY(f.rows[0]),
    w: span(f.cols[0], f.cols[1]), h: span(f.rows[0], f.rows[1]),
  }));

  // Every room is a sealed 20x12 box (per the design spec, "no exceptions") — wall it off
  // so nothing (a strong gust, a missed jump) can carry a gnome off the edge of the buffer.
  solids.push(
    { x: -24, y: -1000, w: 24, h: 2000 },
    { x: BUFFER_W, y: -1000, w: 24, h: 2000 },
    { x: -24, y: -24, w: BUFFER_W + 48, h: 24 },
  );

  dynamicSolids = [];
  water = [];
  levers = [];
  bridges = [];
  gusts = [];
  fanHousings = [];
  exits = [];
  breakableWalls = [];
  holdSwitches = [];
  gates = [];
  pushBlocks = [];
  plates = [];
  updrafts = [];
  ledges = [];
  steppingStoneGroups = [];
  brittleTiles = [];
  timedPlatforms = [];
  voids = [];
  pillars = [];

  const starts = {};

  for (const el of def.elements) {
    switch (el.type) {
      case 'start':
        starts[el.who] = el;
        break;
      case 'water':
        water.push({
          x: colX(el.cols[0]), y: rowY(el.rows[0]),
          w: span(el.cols[0], el.cols[1]), h: span(el.rows[0], el.rows[1]),
        });
        break;
      case 'lever':
        levers.push({
          x: colX(el.col), y: rowY(el.row), w: TILE, h: TILE,
          raises: el.raises, spawns: el.spawns, starts: el.starts, activated: false,
        });
        break;
      case 'bridge':
        bridges.push({
          x: colX(el.cols[0]), y: rowY(el.row), w: span(el.cols[0], el.cols[1]), h: 12,
          initiallyAbsent: !!el.initiallyAbsent, active: !el.initiallyAbsent,
        });
        break;
      case 'fanHousing':
        fanHousings.push({ x: colX(el.col), y: rowY(el.row), w: TILE, h: TILE, id: el.id, dir: el.dir });
        break;
      case 'gust':
        gusts.push({
          x: colX(el.cols[0]), y: rowY(el.row), w: span(el.cols[0], el.cols[1]), h: TILE,
          dir: el.dir, source: el.source, active: true, plateOff: false,
        });
        break;
      case 'exit':
        exits.push({
          x: colX(el.cols[0]), y: rowY(el.rows[0]),
          w: span(el.cols[0], el.cols[1]), h: span(el.rows[0], el.rows[1]),
          who: el.who, // set only in paired-door rooms (room 6); shared-pad rooms leave it undefined
        });
        break;
      case 'breakableWall':
        breakableWalls.push({
          x: colX(el.col), y: rowY(el.rows[0]), w: TILE, h: span(el.rows[0], el.rows[1]),
          broken: false, breakable: true,
        });
        break;
      case 'holdSwitch':
        holdSwitches.push({
          x: colX(el.col), y: rowY(el.row) + TILE / 2, w: TILE, h: TILE / 2,
          opens: el.opens, held: false,
        });
        break;
      case 'gate':
        gates.push({
          id: el.id, x: colX(el.col), y: rowY(el.rows[0]), w: TILE, h: span(el.rows[0], el.rows[1]),
          heldOpen: false, latched: false,
        });
        break;
      case 'pushBlock':
        pushBlocks.push({ x: colX(el.col), y: rowY(el.row), w: TILE, h: TILE });
        break;
      case 'plate':
        plates.push({
          x: colX(el.col), y: rowY(el.row) + TILE / 2, w: TILE, h: TILE / 2,
          latches: el.latches, switchesOff: el.switchesOff, pressed: false,
        });
        break;
      case 'updraft':
        updrafts.push({
          x: colX(el.cols[0]), y: rowY(el.rows[0]),
          w: span(el.cols[0], el.cols[1]), h: span(el.rows[0], el.rows[1]),
        });
        break;
      case 'ledge':
        // Sub-tile deck (12px, per the "half-tile only" rule) so it reads distinct from floor.
        // voffset (px, optional) nudges it down within the tile — a single jump's apex clears
        // a full-height ledge with only ~3px to spare, which timing can't reliably hit; half
        // a tile of slack turns that into a comfortable margin.
        ledges.push({
          x: colX(el.cols[0]), y: rowY(el.row) + (el.voffset || 0),
          w: span(el.cols[0], el.cols[1]), h: 12,
        });
        break;
      case 'steppingStones': {
        // Top flush with the floor line (row+1's top), like the bridge, so a gnome steps
        // onto it instead of hitting its edge like a wall; it extends down into the water.
        const stones = el.cols.map((c) => ({ x: colX(c), y: rowY(el.row + 1), w: TILE, h: 8 }));
        steppingStoneGroups.push({ stones, active: !el.initiallyAbsent });
        break;
      }
      case 'brittleFloor': {
        const cols = el.cols || [el.col, el.col];
        for (let c = cols[0]; c <= cols[1]; c++) {
          brittleTiles.push({ x: colX(c), y: rowY(el.row), w: TILE, h: 8, broken: false, warnFrames: 0 });
        }
        break;
      }
      case 'timedPlatform': {
        // travel[0]/[1] are the left edge's tile range; with this room's numbers that lands
        // the left edge flush with the west floor at minX and the right edge flush with the
        // east floor at maxX — a clean ferry, not a leftover hop at either end.
        const w = el.widthTiles * TILE;
        const minX = colX(el.travel[0]);
        const maxX = colX(el.travel[1]);
        timedPlatforms.push({
          x: minX, y: rowY(el.row), w, h: 12,
          minX, maxX, dir: 1, speed: 0.55, running: false,
        });
        break;
      }
      case 'void':
        voids.push({
          x: colX(el.cols[0]), y: rowY(el.rows[0]),
          w: span(el.cols[0], el.cols[1]), h: span(el.rows[0], el.rows[1]),
        });
        break;
      case 'pillar': {
        // Body segments block everyone; the window is only a solid barrier for whichever
        // kind is NOT in passableBy, so Wind (say) can fly through while Stone cannot.
        const segments = el.rows.map(([r0, r1]) => ({
          x: colX(el.col), y: rowY(r0), w: TILE, h: span(r0, r1),
        }));
        const [wr0, wr1] = el.windowRows;
        const windowBarrier = { x: colX(el.col), y: rowY(wr0), w: TILE, h: span(wr0, wr1) };
        pillars.push({ segments, windowBarrier, passableBy: el.passableBy });
        break;
      }
      default:
        console.warn('Unhandled element type in room', def.id, ':', el.type);
    }
  }

  // Wire holdSwitch -> gate and plate -> gate/gust by id now that every element exists.
  for (const hs of holdSwitches) hs.gate = findById(gates, hs.opens);
  for (const pl of plates) pl.gate = findById(gates, pl.latches);
  for (const pl of plates) if (pl.switchesOff) pl.targetGust = gusts.find((g) => g.source === pl.switchesOff);
  // Only one stepping-stone group / timed platform exists per room so far; wire by kind.
  for (const lv of levers) if (lv.spawns === 'steppingStones') lv.stoneGroup = steppingStoneGroups[0];
  for (const lv of levers) if (lv.starts === 'timedPlatform') lv.platform = timedPlatforms[0];

  for (const p of players) {
    const s = starts[p.kind];
    if (s) p.setStart(s.col, s.row);
    p.reset();
  }

  levelComplete = false;
  message = '';
  messageTimer = 0;
  particles = [];
}

function loadRoom(id) {
  currentRoomId = id;
  buildRoom(LEVELS[id]);
}

function gateIsOpen(g) {
  return g.heldOpen || g.latched;
}

// A pillar's window barrier blocks everyone except the kind named in passableBy. Pass the
// asking player's kind so it's excluded correctly; omitting forKind (e.g. for block-pushing,
// where nothing should fly through a wind-only gap) blocks it for everyone, same as a wall.
function getAllSolids(forKind) {
  const list = [...solids, ...ledges, ...timedPlatforms];
  for (const b of bridges) if (b.active) list.push(b);
  for (const w of breakableWalls) if (!w.broken) list.push(w);
  for (const g of gates) if (!gateIsOpen(g)) list.push(g);
  for (const b of pushBlocks) list.push(b);
  for (const grp of steppingStoneGroups) if (grp.active) list.push(...grp.stones);
  for (const t of brittleTiles) if (!t.broken) list.push(t);
  for (const p of pillars) {
    list.push(...p.segments);
    if (forKind !== p.passableBy) list.push(p.windowBarrier);
  }
  return list;
}

// A thin wall exactly one tile past each pluggable gust's mouth — blocks only (not
// players) are stopped by it, so a pushed block can't be shoved past the mouth and out
// the far side, which would silently un-plug the fan it was meant to kill.
function gustBlockStoppers() {
  const list = [];
  for (const g of gusts) {
    if (!g.source) continue;
    if (g.dir === 'left') {
      list.push({ x: g.x + g.w - TILE - 1, y: g.y, w: 1, h: g.h });
    } else {
      list.push({ x: g.x + TILE, y: g.y, w: 1, h: g.h });
    }
  }
  return list;
}

// ============================================================================
// Player
// ============================================================================
class Player {
  constructor(kind, controls) {
    this.kind = kind;
    this.controls = controls;
    this.w = kind === 'stone' ? 16 : 14;
    this.h = 22;
    this.startX = 0;
    this.startY = 0;
    this.animId = null;
    this.animFrame = 0;
    this.animTime = 0;
    this.reset();
  }

  setStart(col, row) {
    this.startX = colX(col) + (TILE - this.w) / 2;
    this.startY = rowY(row + 1) - this.h;
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
    this.pushing = false;
    this.blown = false;
    this.animId = null;
    this.animFrame = 0;
    this.animTime = 0;
    this.standingOn = null;
  }

  get maxJumps() {
    return this.kind === 'wind' ? 2 : 1;
  }

  update(dt) {
    let left = keys.has(this.controls.left);
    let right = keys.has(this.controls.right);
    let jumpPressed = keys.has(this.controls.jump);

    if (left && !right) {
      this.vx = -MOVE_SPEED;
      this.facing = -1;
    } else if (right && !left) {
      this.vx = MOVE_SPEED;
      this.facing = 1;
    } else {
      this.vx = 0;
    }

    if (jumpPressed && !this.jumpKeyLatch) {
      if (this.onGround || this.jumpsUsed < this.maxJumps) {
        this.vy = this.kind === 'wind' ? JUMP_V_WIND : JUMP_V_STONE;
        this.jumpsUsed++;
        this.onGround = false;
      }
    }
    this.jumpKeyLatch = jumpPressed;

    let gravity = GRAVITY;
    if (this.kind === 'wind' && jumpPressed && this.vy > 0) {
      gravity *= GLIDE_GRAVITY_SCALE;
    }

    this.blown = false;
    for (const g of gusts) {
      if (!g.active) continue;
      if (!rectsOverlap(this.hitbox(), g)) continue;
      const dirSign = g.dir === 'left' ? -1 : 1;
      if (this.kind === 'stone') {
        this.vx += GUST_PUSH_STONE * dirSign;
      } else {
        this.vx += 0.6 * dirSign;
        this.blown = true;
      }
    }

    this.vy += gravity;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // Updraft: a strong, speed-capped rise for Wind (an elevator, not accelerating lift —
    // predictable enough to tune a jump-in entry against a ledge height). Stone gets shoved
    // sideways instead, so it can't use the column as an unintended shortcut across water.
    for (const u of updrafts) {
      if (!rectsOverlap(this.hitbox(), u)) continue;
      if (this.kind === 'wind') {
        this.vy = Math.min(this.vy, -UPDRAFT_RISE_WIND);
      } else {
        this.vx += UPDRAFT_SHOVE_STONE;
      }
    }

    this.pushing = false;
    if (this.kind === 'stone') this.pushBlockIfNeeded();

    // Y before X: resolving horizontal movement first checks the new x against the *old*
    // (still-airborne) y, so a character about to land on a platform this frame reads as
    // hitting its side instead of landing on top. Landing Y first means by the time X runs,
    // a successful landing has already snapped the character flush on the surface, so X sees
    // no overlap to block. (The reverse case — jumping up into a ceiling — still resolves
    // correctly either order, since that collision doesn't depend on this frame's x.)
    this.y += this.vy;
    this.onGround = false;
    this.standingOn = null;
    this.resolveCollisions('y');

    this.x += this.vx;
    this.resolveCollisions('x');

    // Standing on solid ground never drowns, even if that ground geometrically coincides
    // with a water tile above/around it (e.g. a tunnel floor directly below a water hazard —
    // the 24px tile leaves only 2px of clearance over a 22px hitbox, so overlap alone can't
    // distinguish "walking safely underneath" from "actually submerged"; solid support can).
    if (this.kind === 'stone' && !this.standingOn && rectsOverlap(this.hitbox(), this.expandedWaterCheck()) && !this.standingOnBridge()) {
      this.die('Stone Gnome sank in the water!');
    }

    if (this.y > VOID_Y) {
      this.die('Fell too far!');
    }

    this.updateAnim(dt);
  }

  expandedWaterCheck() {
    // Return the first overlapping water rect, or an inert rect if none.
    for (const w of water) if (rectsOverlap(this.hitbox(), w)) return w;
    return { x: -9999, y: -9999, w: 0, h: 0 };
  }

  standingOnBridge() {
    for (const b of bridges) {
      if (!b.active) continue;
      if (rectsOverlap(this.hitbox(), { x: b.x, y: b.y - 3, w: b.w, h: b.h + 6 })) return true;
    }
    return false;
  }

  hitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  // Stone-only: nudge a flush-adjacent pushBlock along by the same delta, provided nothing
  // else blocks its path. Only one block moves per frame.
  pushBlockIfNeeded() {
    if (this.vx === 0) return;
    for (const block of pushBlocks) {
      const nextBox = { x: this.x + this.vx, y: this.y, w: this.w, h: this.h };
      if (!rectsOverlap(nextBox, block)) continue;
      const pushingRight = this.vx > 0 && this.x + this.w <= block.x + 1;
      const pushingLeft = this.vx < 0 && this.x >= block.x + block.w - 1;
      if (!pushingRight && !pushingLeft) continue;

      const blockNext = { ...block, x: block.x + this.vx };
      // Blocks stop exactly at a gust's mouth tile — otherwise a block can be shoved straight
      // through and out the far side, quietly un-plugging the fan it was meant to kill.
      const stoppers = [...getAllSolids(), ...gustBlockStoppers()];
      const hitWall = stoppers.some((s) => s !== block && rectsOverlap(blockNext, s));
      if (hitWall) {
        this.vx = 0;
      } else {
        block.x = blockNext.x;
        this.pushing = true;
      }
      return;
    }
  }

  resolveCollisions(axis) {
    const box = this.hitbox();
    for (const s of getAllSolids(this.kind)) {
      if (!rectsOverlap(box, s)) continue;
      if (axis === 'x' && s.breakable && this.kind === 'stone') {
        s.broken = true;
        spawnDebris(s);
        continue; // shatters instantly — Stone passes straight through, no clamp
      }
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
          this.standingOn = s;
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
    setTimeout(restartCurrentRoom, 550);
  }

  // Choose the sheet id + effective playback rate for the current state. Missing states
  // (stone break/sink, wind jump/glide) fall back to the nearest existing frame per design
  // decision, rather than blocking on unauthored art.
  chooseAnim() {
    if (this.kind === 'stone') {
      if (this.pushing) return 'stone-push';
      if (this.vx !== 0 && this.onGround) return 'stone-walk';
      return 'stone-idle'; // also stands in for airborne (no dedicated jump frame yet)
    }
    if (this.blown) return 'wind-blown';
    if (this.vx !== 0 && this.onGround) return 'wind-walk';
    return 'wind-idle'; // also stands in for jump/glide (no dedicated frames yet)
  }

  updateAnim(dt) {
    const id = this.chooseAnim();
    if (id !== this.animId) {
      this.animId = id;
      this.animTime = 0;
      this.animFrame = 0;
    } else {
      this.animTime += dt;
    }
    const sheet = getSpriteSheet(id);
    if (sheet) {
      const frameDur = 1000 / sheet.fps;
      const n = sheet.frames.length;
      this.animFrame = ((Math.floor(this.animTime / frameDur) % n) + n) % n;
    }
  }

  draw() {
    const sheet = getSpriteSheet(this.animId) || getSpriteSheet(this.kind === 'stone' ? 'stone-idle' : 'wind-idle');
    if (!sheet) return;
    const cx = Math.round(this.x + this.w / 2);
    const bottom = Math.round(this.y + this.h);
    const drawX = cx - sheet.w / 2;
    const drawY = bottom - sheet.h;

    // Contact shadow: 2px ink ellipse at 40% alpha beneath the character.
    bctx.fillStyle = 'rgba(20, 19, 31, 0.4)';
    bctx.fillRect(Math.round(cx - sheet.w / 3), bottom - 1, Math.round((sheet.w * 2) / 3), 2);

    bctx.save();
    if (this.facing < 0) {
      bctx.translate(cx, 0);
      bctx.scale(-1, 1);
      drawSpriteFrame(bctx, sheet, this.animFrame, -sheet.w / 2, drawY, 1);
    } else {
      drawSpriteFrame(bctx, sheet, this.animFrame, Math.round(drawX), drawY, 1);
    }
    bctx.restore();
  }
}

const stoneGnome = new Player('stone', { left: 'KeyA', right: 'KeyD', jump: 'KeyW' });
const windGnome = new Player('wind', { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp' });
const players = [stoneGnome, windGnome];

// ============================================================================
// Level state / mutable flags
// ============================================================================
let message = '';
let messageTimer = 0;
let levelComplete = false;
let lastTime = 0;
let particles = [];
let debris = [];

// ============================================================================
// Shell — title, level-select tower, pause, room-cleared. All four in the same
// 480x288 buffer and palette as the game itself; see README "The shell".
// ============================================================================
const ROOM_COUNT = 6;
const ROOM_NAMES = {
  1: 'Overgrown Ruins', 2: 'The Cracked Vault', 3: 'Updraft Shaft',
  4: 'Brittle Causeway', 5: 'Crosswind Gallery', 6: 'The Two Doors',
};
const PROGRESS_KEY = 'gnomeEscapeProgress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) { /* localStorage unavailable — play without persistence */ }
  return new Set();
}
function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...clearedRooms])); } catch (e) { /* ignore */ }
}

let clearedRooms = loadProgress();
let gameState = 'title'; // 'title' | 'tower' | 'playing' | 'paused' | 'cleared'
let selectedRoom = Math.min(ROOM_COUNT, Math.max(1, [...clearedRooms].reduce((m, r) => Math.max(m, r + 1), 1)));
let roomStartTime = 0;
let roomResetCount = 0;
let clearedStats = { name: '', time: 0, resets: 0 };
let titleAnimTime = 0;

function isUnlocked(id) {
  return id === 1 || clearedRooms.has(id - 1);
}

function enterTower() {
  gameState = 'tower';
  if (!isUnlocked(selectedRoom)) selectedRoom = 1;
}

function moveTowerSelection(dir) {
  let next = selectedRoom;
  for (let i = 0; i < ROOM_COUNT; i++) {
    next += dir;
    if (next < 1 || next > ROOM_COUNT) return;
    if (isUnlocked(next)) { selectedRoom = next; return; }
  }
}

function startSelectedRoom() {
  if (!isUnlocked(selectedRoom)) return;
  currentRoomId = selectedRoom;
  loadRoom(currentRoomId);
  roomStartTime = performance.now();
  roomResetCount = 0;
  gameState = 'playing';
}

function pauseGame() {
  if (gameState === 'playing') gameState = 'paused';
}
function resumeGame() {
  if (gameState === 'paused') gameState = 'playing';
}

function restartCurrentRoom() {
  roomResetCount++;
  loadRoom(currentRoomId);
  gameState = 'playing';
}

function onRoomCleared() {
  clearedRooms.add(currentRoomId);
  saveProgress();
  clearedStats = {
    name: ROOM_NAMES[currentRoomId],
    time: (performance.now() - roomStartTime) / 1000,
    resets: roomResetCount,
  };
  gameState = 'cleared';
}

function advanceFromCleared() {
  const next = currentRoomId + 1;
  if (next <= ROOM_COUNT) {
    selectedRoom = next;
  } else {
    selectedRoom = currentRoomId;
  }
  enterTower();
}

function spawnDebris(rect) {
  for (let i = 0; i < 6; i++) {
    debris.push({
      x: rect.x + Math.random() * rect.w,
      y: rect.y + Math.random() * rect.h,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1 - Math.random() * 1.5,
      life: 20,
      maxLife: 20,
    });
  }
}

function updateDebris() {
  for (const d of debris) {
    d.x += d.vx;
    d.y += d.vy;
    d.vy += 0.2;
    d.life--;
  }
  debris = debris.filter((d) => d.life > 0);
}

// ============================================================================
// Element updates
// ============================================================================
function updateLevers() {
  for (const lv of levers) {
    if (lv.activated) continue;
    for (const p of players) {
      if (rectsOverlap(p.hitbox(), lv)) {
        lv.activated = true;
        if (lv.raises === 'bridge') {
          for (const b of bridges) b.active = true;
          message = 'Bridge raised!';
        } else if (lv.spawns === 'steppingStones' && lv.stoneGroup) {
          lv.stoneGroup.active = true;
          message = 'Stepping stones dropped!';
        } else if (lv.starts === 'timedPlatform' && lv.platform) {
          lv.platform.running = true;
          message = 'Platform moving!';
        }
        messageTimer = 90;
      }
    }
  }
}

// Recomputed from overlap every frame — unlike the latching lever, a gate held open by a
// switch closes the instant nobody is standing on it (unless separately latched by a plate).
function updateHoldSwitches() {
  for (const hs of holdSwitches) {
    hs.held = players.some((p) => rectsOverlap(p.hitbox(), hs));
    if (hs.gate) hs.gate.heldOpen = hs.held;
  }
}

function updatePlates() {
  for (const pl of plates) {
    if (pl.pressed) continue;
    if (pushBlocks.some((b) => rectsOverlap(b, pl))) {
      pl.pressed = true;
      if (pl.gate) {
        pl.gate.latched = true;
        message = 'Gate latched open!';
        messageTimer = 90;
      }
      if (pl.targetGust) {
        pl.targetGust.plateOff = true;
        message = 'Gust stopped!';
        messageTimer = 90;
      }
    }
  }
}

// A pushBlock shoved into a gust's mouth tile (the tile nearest its source fan) kills that
// gust's airflow — reversible in principle (nothing here assumes it's one-way), though the
// design deliberately keeps blocks non-pullable so in practice it plays as permanent.
function updateGustPlugs() {
  for (const g of gusts) {
    if (!g.source) continue;
    const mouth = g.dir === 'left'
      ? { x: g.x + g.w - TILE, y: g.y, w: TILE, h: g.h }
      : { x: g.x, y: g.y, w: TILE, h: g.h };
    const plugged = pushBlocks.some((b) => rectsOverlap(b, mouth));
    g.active = !g.plateOff && !plugged;
  }
}

// Room 5 only: no general pathfinder, just a direct check of the room's one traversal edge.
// If Wind is stuck west of the void with no gust and no bridge, name the cause after a beat
// rather than leaving the player to discover it's unwinnable on their own.
let strandedFrames = 0;
function updateStrandedDetector() {
  if (!room || room.id !== 5 || !gusts.length || !bridges.length) {
    strandedFrames = 0;
    return;
  }
  const voidStartX = colX(8);
  const stranded = windGnome.x < voidStartX && !gusts[0].active && !bridges[0].active;
  if (stranded) {
    strandedFrames++;
    if (strandedFrames > 180 && messageTimer <= 0) {
      message = 'Wind Gnome has no way across. Press R to reset.';
      messageTimer = 200;
    }
  } else {
    strandedFrames = 0;
  }
}

// Breaks only under Stone (never Wind), after 4 continuous frames of standing on it — long
// enough that stepping off or jumping in time genuinely saves you, per the design spec.
function updateBrittleFloors() {
  for (const tile of brittleTiles) {
    if (tile.broken) continue;
    if (stoneGnome.standingOn === tile) {
      tile.warnFrames++;
      if (tile.warnFrames >= 4) {
        tile.broken = true;
        spawnDebris(tile);
      }
    } else {
      tile.warnFrames = 0;
    }
  }
}

function updateTimedPlatforms(dt) {
  for (const tp of timedPlatforms) {
    if (!tp.running) continue;
    const prevX = tp.x;
    tp.x += tp.speed * tp.dir * (dt / 16.67);
    if (tp.x >= tp.maxX) {
      tp.x = tp.maxX;
      tp.dir = -1;
    } else if (tp.x <= tp.minX) {
      tp.x = tp.minX;
      tp.dir = 1;
    }
    const delta = tp.x - prevX;
    for (const p of players) {
      if (p.standingOn === tp) p.x += delta;
    }
  }
}

function updateGusts(dt) {
  for (const g of gusts) {
    if (!g.active) continue;
    if (Math.random() < 0.35) {
      const dirSign = g.dir === 'left' ? -1 : 1;
      particles.push({
        x: dirSign > 0 ? g.x : g.x + g.w,
        y: g.y + Math.random() * g.h,
        vx: dirSign * (1.2 + Math.random() * 0.8),
        life: 30,
      });
    }
  }
  particles.forEach((pt) => { pt.x += pt.vx; pt.life--; });
  particles = particles.filter((pt) => pt.life > 0);
}

function updateExit() {
  if (!exits.length) return;
  // Paired doors (room 6): each door is owned by one gnome and must hold them specifically.
  // Recomputed fresh every frame, never latched — either gnome stepping out cancels it,
  // exactly like the shared pad, just with the assignment fixed instead of interchangeable.
  const paired = exits.some((ex) => ex.who);
  const bothIn = paired
    ? exits.every((ex) => {
        const p = players.find((pl) => pl.kind === ex.who);
        return p && rectsOverlap(p.hitbox(), ex);
      })
    : players.every((p) => exits.some((ex) => rectsOverlap(p.hitbox(), ex)));
  if (bothIn && !levelComplete) {
    levelComplete = true;
    onRoomCleared();
  }
}

// ============================================================================
// Drawing — flat rectangles in the locked palette (art pass comes later).
// ============================================================================
function drawHaze() {
  const [light, near, far, recess] = hazeColors;
  const bandTop = Math.round(BUFFER_H * 0.34);
  const bandMid = Math.round(BUFFER_H * 0.72);
  bctx.fillStyle = light;
  bctx.fillRect(0, 0, BUFFER_W, bandTop);
  bctx.fillStyle = near;
  bctx.fillRect(0, bandTop, BUFFER_W, bandMid - bandTop);
  bctx.fillStyle = recess;
  bctx.fillRect(0, bandMid, BUFFER_W, BUFFER_H - bandMid);
  void far; // reserved for void/gap back-walls once those elements exist in a room
}

function drawSolids() {
  for (const s of solids) {
    bctx.fillStyle = PALETTE.ink.body;
    bctx.fillRect(s.x, s.y, s.w, s.h);
    bctx.fillStyle = PALETTE.ink.facet;
    bctx.fillRect(s.x, s.y, s.w, 4);
  }
}

function drawVoids() {
  // "No top facet at all — the tell" per the art bible: pure ink.void, no rim light.
  for (const v of voids) {
    bctx.fillStyle = PALETTE.ink.void;
    bctx.fillRect(v.x, v.y, v.w, v.h);
  }
}

function drawBrittleFloors() {
  for (const tile of brittleTiles) {
    if (tile.broken) continue;
    const shiver = tile.warnFrames > 0 ? (tile.warnFrames % 2 === 0 ? 1 : -1) : 0;
    bctx.fillStyle = PALETTE.ink.body;
    bctx.fillRect(tile.x + shiver, tile.y, tile.w, tile.h);
    // Top facet broken into teeth, gold hairline — the "unsafe material" tell.
    bctx.fillStyle = PALETTE.signal.interactive[1];
    for (let tx = tile.x; tx < tile.x + tile.w; tx += 8) {
      bctx.fillRect(tx + shiver + 1, tile.y, 6, 2);
    }
  }
}

function drawTimedPlatforms() {
  for (const tp of timedPlatforms) {
    bctx.fillStyle = PALETTE.ink.body;
    bctx.fillRect(tp.x, tp.y, tp.w, tp.h);
    bctx.fillStyle = PALETTE.signal.interactive[1];
    bctx.fillRect(tp.x, tp.y + tp.h - 2, tp.w, 2);
  }
}

function drawPillars() {
  for (const p of pillars) {
    for (const seg of p.segments) {
      bctx.fillStyle = PALETTE.ink.body;
      bctx.fillRect(seg.x, seg.y, seg.w, seg.h);
      bctx.fillStyle = PALETTE.ink.facet;
      bctx.fillRect(seg.x, seg.y, seg.w, 4);
    }
    // The window itself is never drawn solid — its win/wind-only barrier is invisible;
    // a faint tint is enough to read "gap", not "wall".
    const w = p.windowBarrier;
    bctx.fillStyle = 'rgba(127, 224, 176, 0.12)';
    bctx.fillRect(w.x, w.y, w.w, w.h);
  }
}

function drawWater() {
  for (const w of water) {
    const sheet = getSpriteSheet('water-surface');
    bctx.fillStyle = PALETTE.signal.water[1];
    bctx.fillRect(w.x, w.y, w.w, w.h);
    if (sheet) {
      const frameIdx = Math.floor(performance.now() / (1000 / sheet.fps)) % sheet.frames.length;
      for (let tx = w.x; tx < w.x + w.w; tx += TILE) {
        drawSpriteFrame(bctx, sheet, frameIdx, tx, w.y, 1);
      }
    }
  }
}

function drawBridges() {
  for (const b of bridges) {
    if (!b.active) continue;
    bctx.fillStyle = PALETTE.signal.interactive[1];
    bctx.fillRect(b.x, b.y, b.w, b.h);
    bctx.fillStyle = PALETTE.signal.interactive[0];
    bctx.fillRect(b.x, b.y, b.w, 2);
  }
}

function drawLevers() {
  const sheet = getSpriteSheet('lever');
  for (const lv of levers) {
    const frameIdx = lv.activated ? 2 : 0;
    if (sheet) drawSpriteFrame(bctx, sheet, frameIdx, lv.x, lv.y, 1);
  }
}

function drawBreakableWalls() {
  for (const w of breakableWalls) {
    if (w.broken) continue;
    bctx.fillStyle = PALETTE.ink.body;
    bctx.fillRect(w.x, w.y, w.w, w.h);
    bctx.fillStyle = PALETTE.ink.facet;
    bctx.fillRect(w.x, w.y, w.w, 4);
    // Diagonal fracture, gold hairline — the tell that this silhouette is breakable.
    bctx.strokeStyle = PALETTE.signal.interactive[1];
    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(w.x + 3, w.y + 6);
    bctx.lineTo(w.x + w.w - 4, w.y + w.h * 0.42);
    bctx.lineTo(w.x + 4, w.y + w.h * 0.68);
    bctx.lineTo(w.x + w.w - 5, w.y + w.h - 6);
    bctx.stroke();
  }
}

function drawGates() {
  for (const g of gates) {
    if (gateIsOpen(g)) continue;
    bctx.fillStyle = PALETTE.ink.body;
    for (let bx = g.x + 2; bx < g.x + g.w - 1; bx += 6) {
      bctx.fillRect(bx, g.y, 3, g.h);
    }
    bctx.fillStyle = PALETTE.signal.interactive[1];
    bctx.fillRect(g.x, g.y, g.w, 3);
    bctx.fillRect(g.x, g.y + g.h - 3, g.w, 3);
  }
}

function drawPushBlocks() {
  const sheet = getSpriteSheet('block');
  for (const b of pushBlocks) {
    if (sheet) drawSpriteFrame(bctx, sheet, 0, b.x, b.y, 1);
  }
}

function drawHoldSwitches() {
  // Reuses the pressure-plate art (no dedicated hold-switch sprite yet) — same read
  // ("gold means a gnome can act on it"), distinct only in that it isn't a permanent latch.
  const sheet = getSpriteSheet('plate');
  for (const hs of holdSwitches) {
    if (sheet) drawSpriteFrame(bctx, sheet, hs.held ? 1 : 0, hs.x, hs.y, 1);
  }
}

function drawPlates() {
  const sheet = getSpriteSheet('plate');
  for (const pl of plates) {
    if (sheet) drawSpriteFrame(bctx, sheet, pl.pressed ? 1 : 0, pl.x, pl.y, 1);
  }
}

function drawDebris() {
  for (const d of debris) {
    bctx.globalAlpha = Math.max(0, d.life / d.maxLife);
    bctx.fillStyle = PALETTE.ink.body;
    bctx.fillRect(Math.round(d.x), Math.round(d.y), 3, 3);
  }
  bctx.globalAlpha = 1;
}

function drawFansAndGusts() {
  for (const fh of fanHousings) {
    bctx.fillStyle = PALETTE.ink.body;
    bctx.fillRect(fh.x, fh.y, fh.w, fh.h);
    bctx.strokeStyle = PALETTE.ink.detail;
    bctx.beginPath();
    bctx.arc(fh.x + fh.w / 2, fh.y + fh.h / 2, fh.w / 2 - 3, 0, Math.PI * 2);
    bctx.stroke();
  }
  for (const g of gusts) {
    if (!g.active) continue;
    const grad = bctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y);
    grad.addColorStop(0, 'rgba(239, 230, 255, 0.05)');
    grad.addColorStop(0.5, 'rgba(205, 188, 255, 0.22)');
    grad.addColorStop(1, 'rgba(239, 230, 255, 0.05)');
    bctx.fillStyle = grad;
    bctx.fillRect(g.x, g.y, g.w, g.h);
  }
  bctx.fillStyle = PALETTE.signal.gust[0];
  for (const pt of particles) {
    bctx.fillRect(Math.round(pt.x), Math.round(pt.y), 3, 2);
  }
}

function drawUpdrafts() {
  for (const u of updrafts) {
    const grad = bctx.createLinearGradient(u.x, u.y, u.x, u.y + u.h);
    grad.addColorStop(0, 'rgba(239, 230, 255, 0.05)');
    grad.addColorStop(0.5, 'rgba(205, 188, 255, 0.22)');
    grad.addColorStop(1, 'rgba(239, 230, 255, 0.05)');
    bctx.fillStyle = grad;
    bctx.fillRect(u.x, u.y, u.w, u.h);
    const t = performance.now() / 90;
    bctx.fillStyle = PALETTE.signal.gust[0];
    for (let i = 0; i < 4; i++) {
      const py = u.y + u.h - ((t + i * (u.h / 4)) % u.h);
      bctx.fillRect(Math.round(u.x + u.w / 2 - 1), Math.round(py), 2, 4);
    }
  }
}

function drawLedges() {
  for (const l of ledges) {
    bctx.fillStyle = PALETTE.ink.body;
    bctx.fillRect(l.x, l.y, l.w, l.h);
    bctx.fillStyle = PALETTE.ink.facet;
    bctx.fillRect(l.x, l.y, l.w, 3);
  }
}

function drawSteppingStones() {
  for (const grp of steppingStoneGroups) {
    if (!grp.active) continue;
    for (const s of grp.stones) {
      bctx.fillStyle = PALETTE.signal.interactive[1];
      bctx.fillRect(s.x, s.y, s.w, s.h);
      bctx.fillStyle = PALETTE.signal.interactive[0];
      bctx.fillRect(s.x, s.y, s.w, 2);
    }
  }
}

function drawExits() {
  const sheet = getSpriteSheet('exit-door');
  if (!sheet) return;
  const occupied = players.some((p) => exits.some((ex) => rectsOverlap(p.hitbox(), ex)));
  const frameIdx = occupied ? 2 : Math.floor(performance.now() / (1000 / sheet.fps)) % sheet.frames.length;
  for (const ex of exits) {
    const drawX = ex.x + (ex.w - sheet.w) / 2;
    const drawY = ex.y + ex.h - sheet.h;
    drawSpriteFrame(bctx, sheet, frameIdx, Math.round(drawX), Math.round(drawY), 1);
  }
}

function drawMessage() {
  if (messageTimer <= 0) return;
  messageTimer--;
  bctx.fillStyle = levelComplete ? PALETTE.signal.interactive[1] : PALETTE.ink.body;
  bctx.font = levelComplete ? 'bold 16px monospace' : 'bold 9px monospace';
  bctx.textAlign = 'center';
  bctx.fillText(message, BUFFER_W / 2, levelComplete ? BUFFER_H / 2 : 14);
  bctx.textAlign = 'left';
}

function updateGameplay(dt) {
  if (levelComplete) return;
  updateLevers();
  updateHoldSwitches();
  updatePlates();
  updateGustPlugs();
  updateTimedPlatforms(dt);
  updateGusts(dt);
  updateDebris();
  for (const p of players) p.update(dt);
  updateBrittleFloors();
  updateStrandedDetector();
  updateExit();
}

function drawGameplay() {
  drawHaze();
  drawVoids();
  drawWater();
  drawSolids();
  drawPillars();
  drawLedges();
  drawBridges();
  drawSteppingStones();
  drawBrittleFloors();
  drawTimedPlatforms();
  drawBreakableWalls();
  drawGates();
  drawLevers();
  drawHoldSwitches();
  drawPushBlocks();
  drawPlates();
  drawDebris();
  drawFansAndGusts();
  drawUpdrafts();
  drawExits();
  for (const p of players) p.draw();
  drawMessage();
  drawHud();
}

// ============================================================================
// HUD — two 20px corner tags, nothing else. Swatch, controls, a door pip that lights
// when that gnome is in position. No timer, no counter, no ability icons.
// ============================================================================
function drawHudTag(kind, onRight) {
  const w = 108, h = 20;
  const x = onRight ? BUFFER_W - w : 0;
  const y = 0;
  bctx.fillStyle = 'rgba(20, 19, 31, 0.55)';
  bctx.fillRect(x, y, w, h);

  const swatch = kind === 'stone' ? PALETTE.signal.stoneGnome : PALETTE.signal.windGnome;
  bctx.fillStyle = swatch[1];
  bctx.fillRect(x + 4, y + 4, 12, 12);

  bctx.fillStyle = PALETTE.haze.light;
  bctx.font = '8px monospace';
  bctx.textAlign = 'left';
  const label = kind === 'stone' ? 'W A D' : 'UP L R';
  bctx.fillText(label, x + 20, y + 13);

  // Door pip: lit gold when this gnome is currently in an exit zone it owns (or, on a
  // shared pad, any exit at all).
  const player = kind === 'stone' ? stoneGnome : windGnome;
  const inExit = exits.some((ex) => (!ex.who || ex.who === kind) && rectsOverlap(player.hitbox(), ex));
  bctx.fillStyle = inExit ? PALETTE.signal.interactive[0] : PALETTE.ink.detail;
  const pipX = onRight ? x + 4 : x + w - 10;
  bctx.beginPath();
  bctx.arc(pipX + 3, y + 10, 3, 0, Math.PI * 2);
  bctx.fill();
}

function drawHud() {
  drawHudTag('stone', false);
  drawHudTag('wind', true);
}

// ============================================================================
// Shell screens
// ============================================================================
function drawShellHaze(colors) {
  const [light, near, , recess] = colors;
  bctx.fillStyle = light;
  bctx.fillRect(0, 0, BUFFER_W, BUFFER_H * 0.4);
  bctx.fillStyle = near;
  bctx.fillRect(0, BUFFER_H * 0.4, BUFFER_W, BUFFER_H * 0.35);
  bctx.fillStyle = recess;
  bctx.fillRect(0, BUFFER_H * 0.75, BUFFER_W, BUFFER_H * 0.25);
}

function drawRuinSilhouette() {
  // A jagged ink skyline along the bottom edge — cheap, no new assets, reads as "ruin".
  bctx.fillStyle = PALETTE.ink.body;
  const heights = [18, 30, 14, 40, 22, 34, 16, 44, 20, 28, 12, 36, 24, 18, 32];
  const segW = BUFFER_W / heights.length;
  for (let i = 0; i < heights.length; i++) {
    bctx.fillRect(Math.round(i * segW), BUFFER_H - heights[i], Math.ceil(segW) + 1, heights[i]);
  }
}

function drawGnomeIdle(kind, x, y, facing) {
  const sheet = getSpriteSheet(kind === 'stone' ? 'stone-idle' : 'wind-idle');
  if (!sheet) return;
  const frameIdx = Math.floor(titleAnimTime / (1000 / sheet.fps)) % sheet.frames.length;
  bctx.save();
  if (facing < 0) {
    bctx.translate(x + sheet.w, y);
    bctx.scale(-1, 1);
    drawSpriteFrame(bctx, sheet, frameIdx, 0, 0, 1);
  } else {
    drawSpriteFrame(bctx, sheet, frameIdx, x, y, 1);
  }
  bctx.restore();
}

function drawTitleScreen(dt) {
  titleAnimTime += dt;
  drawShellHaze(HAZE_PER_ROOM[1]);
  drawRuinSilhouette();

  bctx.fillStyle = PALETTE.ink.body;
  bctx.font = 'bold 28px monospace';
  bctx.textAlign = 'left';
  bctx.fillText('GNOME ESCAPE', 24, 60);

  drawGnomeIdle('stone', 60, BUFFER_H - 18 - 26, 1);
  drawGnomeIdle('wind', 92, BUFFER_H - 18 - 26, -1);

  const blink = Math.sin(titleAnimTime / 250) > -0.2;
  if (blink) {
    bctx.fillStyle = PALETTE.signal.interactive[1];
    bctx.font = 'bold 14px monospace';
    bctx.fillText('▸ PRESS START', 24, 100);
  }
}

function drawTowerScreen() {
  drawShellHaze(HAZE_PER_ROOM[1]);
  drawRuinSilhouette();

  const towerX = BUFFER_W / 2 - 4;
  const baseY = BUFFER_H - 24;
  const rungGap = (baseY - 24) / (ROOM_COUNT - 1);

  bctx.fillStyle = PALETTE.ink.body;
  bctx.fillRect(towerX, 24, 8, baseY - 24);

  for (let id = 1; id <= ROOM_COUNT; id++) {
    const ry = baseY - (id - 1) * rungGap;
    let color;
    if (id === selectedRoom) color = PALETTE.signal.interactive[1];
    else if (clearedRooms.has(id)) color = PALETTE.ink.body;
    else if (isUnlocked(id)) color = PALETTE.ink.facet;
    else color = PALETTE.ink.detail;
    bctx.fillStyle = color;
    bctx.fillRect(towerX - 26, ry - 3, 60, 6);

    if (id === selectedRoom) {
      bctx.fillStyle = PALETTE.signal.interactive[1];
      bctx.font = 'bold 9px monospace';
      bctx.textAlign = 'left';
      bctx.fillText(`${id} · ${ROOM_NAMES[id]}`, towerX + 40, ry + 3);
    }
  }

  bctx.fillStyle = PALETTE.ink.body;
  bctx.font = 'bold 12px monospace';
  bctx.textAlign = 'center';
  bctx.fillText('THE TOWER', BUFFER_W / 2, 16);
  bctx.font = '8px monospace';
  bctx.fillStyle = PALETTE.haze.recess;
  bctx.fillText('↑/↓ SELECT · ENTER TO CLIMB IN', BUFFER_W / 2, BUFFER_H - 6);
  bctx.textAlign = 'left';
}

function drawPauseOverlay() {
  drawGameplay();
  bctx.fillStyle = 'rgba(20, 19, 31, 0.72)';
  bctx.fillRect(0, 0, BUFFER_W, BUFFER_H);

  bctx.textAlign = 'center';
  bctx.fillStyle = PALETTE.signal.interactive[1];
  bctx.font = 'bold 14px monospace';
  bctx.fillText('▸ RESUME · ESC', BUFFER_W / 2, BUFFER_H / 2 - 10);
  bctx.fillStyle = PALETTE.haze.light;
  bctx.font = '9px monospace';
  bctx.fillText('RESTART ROOM · R', BUFFER_W / 2, BUFFER_H / 2 + 10);
  bctx.fillText('THE TOWER · T', BUFFER_W / 2, BUFFER_H / 2 + 24);
  bctx.textAlign = 'left';
}

function drawClearedOverlay() {
  drawShellHaze(HAZE_PER_ROOM[1]);

  bctx.textAlign = 'center';
  bctx.fillStyle = PALETTE.ink.body;
  bctx.font = 'bold 16px monospace';
  bctx.fillText(clearedStats.name.toUpperCase(), BUFFER_W / 2, BUFFER_H / 2 - 30);

  bctx.font = '10px monospace';
  bctx.fillText(`TIME ${clearedStats.time.toFixed(1)}s  ·  RESETS ${clearedStats.resets}`, BUFFER_W / 2, BUFFER_H / 2 - 8);

  bctx.fillStyle = PALETTE.signal.interactive[1];
  bctx.font = 'bold 14px monospace';
  const label = currentRoomId < ROOM_COUNT ? '▸ NEXT ROOM' : '▸ THE TOWER';
  bctx.fillText(label, BUFFER_W / 2, BUFFER_H / 2 + 20);
  bctx.textAlign = 'left';
}

// ============================================================================
// Main loop
// ============================================================================
function loop(time) {
  // Clamp to a sane positive range: guards against a zero/negative/huge delta from a
  // backgrounded tab, a clock irregularity, or (in testing) driving loop() with an
  // out-of-order timestamp — any of which would otherwise corrupt animation frame indices.
  let dt = lastTime ? time - lastTime : 16.67;
  if (!(dt > 0) || dt > 50) dt = 16.67;
  lastTime = time;

  switch (gameState) {
    case 'title':
      drawTitleScreen(dt);
      break;
    case 'tower':
      drawTowerScreen();
      break;
    case 'playing':
      updateGameplay(dt);
      drawGameplay();
      break;
    case 'paused':
      drawPauseOverlay();
      break;
    case 'cleared':
      drawClearedOverlay();
      break;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buf, 0, 0, BUFFER_W, BUFFER_H, 0, 0, BUFFER_W * SCALE, BUFFER_H * SCALE);

  requestAnimationFrame(loop);
}

const spriteErrors = validateSprites();
if (spriteErrors.length) console.error('Sprite data errors:', spriteErrors);

requestAnimationFrame(loop);
