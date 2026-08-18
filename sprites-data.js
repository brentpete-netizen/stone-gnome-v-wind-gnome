// Gnome Escape — hand-authored sprite data.
// Adapted from the design handoff's sprites.js (ES module) into a plain script so it can
// load alongside game.js with no build step. Content is unchanged; only `export` is removed.
// Characters are authored as character grids (one char per pixel); props are generated
// from primitives so their geometry is exact. Every colour comes from the locked palette.

const SPRITE_PALETTE = {
  inkVoid: '#14131f',
  inkBody: '#1f1e2e',
  inkFacet: '#2e2c42',
  inkDetail: '#45415d',
  waterLight: '#8fd9e4',
  waterBase: '#4fb0c6',
  gustLight: '#efe6ff',
  gustBase: '#cdbcff',
  goldLight: '#ffe6a3',
  goldBase: '#f0b64e',
  stoneLight: '#f5c99b',
  stoneBase: '#d98c53',
  windLight: '#dffff0',
  windBase: '#7fe0b0',
};

const CHAR_STONE = { '.': null, o: SPRITE_PALETTE.inkBody, b: SPRITE_PALETTE.stoneBase, h: SPRITE_PALETTE.stoneLight };
const CHAR_WIND = { '.': null, o: SPRITE_PALETTE.inkBody, w: SPRITE_PALETTE.windBase, l: SPRITE_PALETTE.windLight };
const CHAR_WATER = { '.': null, c: SPRITE_PALETTE.waterBase, C: SPRITE_PALETTE.waterLight };
const CHAR_PROP = {
  '.': null,
  o: SPRITE_PALETTE.inkBody,
  d: SPRITE_PALETTE.inkDetail,
  g: SPRITE_PALETTE.goldBase,
  G: SPRITE_PALETTE.goldLight,
};

// ---------------------------------------------------------------- Stone Gnome (20 x 26)

const STONE_TORSO = [
  '........oo..........',
  '.......obbo.........',
  '......obbbbo........',
  '.....obbbbbbo.......',
  '....obbbbbbbbo......',
  '...obbbbbbbbbbo.....',
  '..obbbbbbbbbbbbo....',
  '.obbbbbbbbbbbbbbo...',
  '.oobbbbbbbbbbbboo...',
  '.oooooooooooooooo...',
  '...ohhhhhhhhhho.....',
  '...ohohhhhhhoho.....',
  '...ohhhhoohhhho.....',
  '....ohhhhhhhho......',
  '.....ohhhhhho.......',
  '......ohhhho........',
  '...obbbbbbbbbbo.....',
  '..obbbbbbbbbbbbo....',
  '..obbbbbbbbbbbbo....',
  '..obbbbbbbbbbbbo....',
];

const STONE_PUSH_TORSO = [
  '..........oo........',
  '.........obbo.......',
  '........obbbbo......',
  '.......obbbbbbo.....',
  '......obbbbbbbbo....',
  '.....obbbbbbbbbbo...',
  '....obbbbbbbbbbbbo..',
  '...obbbbbbbbbbbbbbo.',
  '..oobbbbbbbbbbbboo..',
  '..oooooooooooooooo..',
  '....ohhhhhhhhhho....',
  '....ohohhhhhhoho....',
  '....ohhhhoohhhho....',
  '.....ohhhhhhhho.....',
  '......ohhhhhho......',
  '.......ohhho........',
  '....obbbbbbbbbbo....',
  '...obbbbbbbbbbbbhho.',
  '...obbbbbbbbbbbbhho.',
  '...obbbbbbbbbbo.....',
];

const STONE_LEGS = {
  // feet together
  A: [
    '...obbbbbbbbbbo.....',
    '...obbbo..obbbo.....',
    '...obbbo..obbbo.....',
    '...obbbo..obbbo.....',
    '...ooooo..ooooo.....',
    '..oooooo..oooooo....',
  ],
  // left foot forward
  B: [
    '...obbbbbbbbbbo.....',
    '..obbbo...obbbo.....',
    '..obbbo...obbbo.....',
    '.obbbo....obbbo.....',
    '.ooooo....ooooo.....',
    'oooooo....oooooo....',
  ],
  // right foot lifted, passing
  C: [
    '...obbbbbbbbbbo.....',
    '...obbbo..obbbo.....',
    '...obbbo..obbbo.....',
    '...obbbo..ooooo.....',
    '...ooooo............',
    '..oooooo............',
  ],
  // left foot lifted, passing
  Cm: [
    '...obbbbbbbbbbo.....',
    '...obbbo..obbbo.....',
    '...obbbo..obbbo.....',
    '...ooooo..obbbo.....',
    '..........ooooo.....',
    '..........oooooo....',
  ],
  // right foot forward
  D: [
    '...obbbbbbbbbbo.....',
    '...obbbo...obbbo....',
    '...obbbo...obbbo....',
    '...obbbo....obbbo...',
    '...ooooo....ooooo...',
    '..oooooo....oooooo..',
  ],
};

// ----------------------------------------------------------------- Wind Gnome (18 x 26)

const WIND_TORSO = [
  '........o.........',
  '.......owo........',
  '.......owo........',
  '......owwwo.......',
  '......owwwo.......',
  '.....owwwwwo......',
  '....owwwwwwwo.....',
  '...owwwwwwwwwo....',
  '..owwwwwwwwwwwo...',
  '..oooooooooooooo..',
  '....ollllllllo....',
  '....olollllolo....',
  '....ollloollllo...',
  '.....ollllllo.....',
  '......ollllo......',
  '...owwwwwwwwwwo...',
  '..owwwwwwwwwwwwo..',
  '..owwwwwwwwwwwwo..',
  '...owwwwwwwwwwo...',
  '...owwwwwwwwwwo...',
];

const WIND_BLOWN_TORSO = [
  '..........o.......',
  '.........owo......',
  '........owo.......',
  '.......owwwo......',
  '......owwwo.......',
  '......owwwwo......',
  '.....owwwwwwo.....',
  '....owwwwwwwwo....',
  '...owwwwwwwwwwo...',
  '...oooooooooooo...',
  '.....ollllllo.....',
  '.....olollolo.....',
  '.....ollllllo.....',
  '......ollllo......',
  '.......ollo.......',
  '.l..owwwwwwwwo....',
  '..lowwwwwwwwwwo...',
  '...owwwwwwwwwwo...',
  '...owwwwwwwwo.....',
  '....owwwwwwo......',
];

const WIND_LEGS = {
  A: [
    '...owwwwwwwwwwo...',
    '....owwo..owwo....',
    '....owwo..owwo....',
    '....owwo..owwo....',
    '....oooo..oooo....',
    '...ooooo..ooooo...',
  ],
  B: [
    '...owwwwwwwwwwo...',
    '...owwo...owwo....',
    '...owwo...owwo....',
    '..owwo....owwo....',
    '..oooo....oooo....',
    '.ooooo....ooooo...',
  ],
  C: [
    '...owwwwwwwwwwo...',
    '....owwo..owwo....',
    '....owwo..owwo....',
    '....owwo..oooo....',
    '....oooo..........',
    '...ooooo..........',
  ],
  Cm: [
    '...owwwwwwwwwwo...',
    '....owwo..owwo....',
    '....owwo..owwo....',
    '....oooo..owwo....',
    '..........oooo....',
    '..........ooooo...',
  ],
  D: [
    '...owwwwwwwwwwo...',
    '....owwo...owwo...',
    '....owwo...owwo...',
    '....owwo....owwo..',
    '....oooo....oooo..',
    '...ooooo....ooooo.',
  ],
  Blown: [
    '....owwwwwwo......',
    '..owwwo...........',
    '.owwwo............',
    'owwo..............',
    'ooo...............',
    '..................',
  ],
};

// ------------------------------------------------------------------------- composition

function spriteBlank(w) {
  return '.'.repeat(w);
}

// Bob the upper body down one pixel without lifting the feet: drop a mid-torso row and
// prepend an empty one. This is how a pixel walk cycle carries weight.
function spriteBob(torso) {
  return [spriteBlank(torso[0].length), ...torso.slice(0, 15), ...torso.slice(16)];
}

function spriteShiftX(rows, dx) {
  if (!dx) return rows;
  const w = rows[0].length;
  return rows.map((r) => {
    if (dx > 0) return (spriteBlank(dx) + r).slice(0, w);
    return (r.slice(-dx) + spriteBlank(-dx)).slice(0, w);
  });
}

function spriteFrame(torso, legs, opts) {
  const o = opts || {};
  let upper = o.bob ? spriteBob(torso) : torso;
  let rows = [...upper, ...legs];
  if (o.dx) rows = spriteShiftX(rows, o.dx);
  return rows;
}

// ------------------------------------------------------------------- generated props

function spriteGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill('.'));
}
function spriteRect(g, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (g[j] && g[j][i] !== undefined) g[j][i] = ch;
    }
  }
}
function spriteOutline(g, x, y, w, h, ch) {
  spriteRect(g, x, y, w, 1, ch);
  spriteRect(g, x, y + h - 1, w, 1, ch);
  spriteRect(g, x, y, 1, h, ch);
  spriteRect(g, x + w - 1, y, 1, h, ch);
}
function spriteLine(g, x0, y0, x1, y1, ch) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    if (g[y] && g[y][x] !== undefined) g[y][x] = ch;
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function spriteToRows(g) {
  return g.map((r) => r.join(''));
}

function waterFrame(phase) {
  const g = spriteGrid(24, 24);
  spriteRect(g, 0, 0, 24, 24, 'c');
  const crests = [
    [1, 3], [8, 2], [13, 3], [19, 2],
    [3, 2], [9, 3], [15, 2], [21, 3],
  ];
  const set = phase === 0 ? crests.slice(0, 4) : crests.slice(4);
  for (const [x, len] of set) {
    spriteRect(g, x, 0, len, 1, 'C');
    spriteRect(g, x + 1, 2, Math.max(1, len - 1), 1, 'C');
  }
  return spriteToRows(g);
}

function leverFrame(ballX) {
  const g = spriteGrid(24, 24);
  spriteRect(g, 7, 20, 10, 4, 'o');       // plinth
  spriteRect(g, 8, 20, 8, 1, 'd');        // plinth facet
  spriteLine(g, 11, 20, ballX + 1, 15, 'g');
  spriteLine(g, 12, 20, ballX + 2, 15, 'g');
  spriteRect(g, ballX, 11, 4, 4, 'G');    // ball
  spriteOutline(g, ballX - 1, 10, 6, 6, 'g');
  return spriteToRows(g);
}

function plateFrame(pressed) {
  const g = spriteGrid(24, 12);
  const y = pressed ? 8 : 6;
  spriteRect(g, 2, y, 20, 12 - y, 'o');
  spriteRect(g, 3, y, 18, 1, pressed ? 'G' : 'g');
  return spriteToRows(g);
}

function blockFrame() {
  const g = spriteGrid(24, 24);
  spriteRect(g, 0, 0, 24, 24, 'o');
  spriteOutline(g, 0, 0, 24, 24, 'g');
  spriteRect(g, 1, 1, 22, 1, 'G');
  // corner notches so a pushable block is never confused with a wall tile
  spriteRect(g, 3, 3, 3, 1, 'G'); spriteRect(g, 3, 3, 1, 3, 'G');
  spriteRect(g, 18, 3, 3, 1, 'G'); spriteRect(g, 20, 3, 1, 3, 'G');
  spriteRect(g, 3, 20, 1, 3, 'G'); spriteRect(g, 3, 20, 3, 1, 'G');
  spriteRect(g, 20, 18, 1, 3, 'G'); spriteRect(g, 18, 20, 3, 1, 'G');
  return spriteToRows(g);
}

function doorFrame(phase) {
  const g = spriteGrid(24, 48);
  // Stone arch in silhouette: shoulders stepped in, jambs down to the floor.
  spriteRect(g, 2, 8, 20, 40, 'o');
  spriteRect(g, 4, 5, 16, 3, 'o');
  spriteRect(g, 7, 3, 10, 2, 'o');
  spriteRect(g, 3, 9, 18, 1, 'd');
  // Doorway. The ink jambs stay 3 px wide so the arch always reads as architecture.
  const bright = phase === 1 || phase === 2;
  const fill = bright ? 'G' : 'g';
  spriteRect(g, 5, 12, 14, 36, fill);
  spriteRect(g, 7, 8, 10, 4, fill);
  spriteRect(g, 9, 5, 6, 3, fill);
  // Breathing core, one step brighter than the doorway at the centre of the cycle.
  spriteRect(g, 8, 18, 8, 26, bright ? 'G' : 'G');
  spriteRect(g, 9, 20, 6, 22, 'G');
  if (!bright) spriteRect(g, 10, 24, 4, 14, 'g');
  return spriteToRows(g);
}

// ------------------------------------------------------------------------- the sheets

const SPRITE_SHEETS = [
  {
    id: 'stone-idle', name: 'Stone Gnome — idle', chars: CHAR_STONE, w: 20, h: 26, fps: 3,
    note: 'Two frames. The bob is one pixel of upper body, nothing else.',
    labels: ['rest', 'breathe'],
    frames: [
      spriteFrame(STONE_TORSO, STONE_LEGS.A, {}),
      spriteFrame(STONE_TORSO, STONE_LEGS.A, { bob: true }),
    ],
  },
  {
    id: 'stone-walk', name: 'Stone Gnome — walk', chars: CHAR_STONE, w: 20, h: 26, fps: 10,
    note: 'Six frames, contact–pass–contact each side. Heavy: the bob lands on the pass frames.',
    labels: ['contact L', 'pass R', 'together', 'contact R', 'pass L', 'together'],
    frames: [
      spriteFrame(STONE_TORSO, STONE_LEGS.B, {}),
      spriteFrame(STONE_TORSO, STONE_LEGS.C, { bob: true }),
      spriteFrame(STONE_TORSO, STONE_LEGS.A, {}),
      spriteFrame(STONE_TORSO, STONE_LEGS.D, {}),
      spriteFrame(STONE_TORSO, STONE_LEGS.Cm, { bob: true }),
      spriteFrame(STONE_TORSO, STONE_LEGS.A, { bob: true }),
    ],
  },
  {
    id: 'stone-push', name: 'Stone Gnome — push', chars: CHAR_STONE, w: 20, h: 26, fps: 8,
    note: 'Leaned forward, arms extended. Cycle only advances while the block is moving.',
    labels: ['plant', 'strain', 'step', 'strain'],
    frames: [
      spriteFrame(STONE_PUSH_TORSO, STONE_LEGS.B, {}),
      spriteFrame(STONE_PUSH_TORSO, STONE_LEGS.A, { bob: true }),
      spriteFrame(STONE_PUSH_TORSO, STONE_LEGS.D, {}),
      spriteFrame(STONE_PUSH_TORSO, STONE_LEGS.A, { bob: true }),
    ],
  },
  {
    id: 'wind-idle', name: 'Wind Gnome — idle', chars: CHAR_WIND, w: 18, h: 26, fps: 4,
    note: 'Faster than Stone by one step. Light characters idle quicker.',
    labels: ['rest', 'breathe'],
    frames: [
      spriteFrame(WIND_TORSO, WIND_LEGS.A, {}),
      spriteFrame(WIND_TORSO, WIND_LEGS.A, { bob: true }),
    ],
  },
  {
    id: 'wind-walk', name: 'Wind Gnome — walk', chars: CHAR_WIND, w: 18, h: 26, fps: 12,
    note: 'Same six-frame structure as Stone, two fps faster and a narrower stride.',
    labels: ['contact L', 'pass R', 'together', 'contact R', 'pass L', 'together'],
    frames: [
      spriteFrame(WIND_TORSO, WIND_LEGS.B, {}),
      spriteFrame(WIND_TORSO, WIND_LEGS.C, { bob: true }),
      spriteFrame(WIND_TORSO, WIND_LEGS.A, {}),
      spriteFrame(WIND_TORSO, WIND_LEGS.D, {}),
      spriteFrame(WIND_TORSO, WIND_LEGS.Cm, { bob: true }),
      spriteFrame(WIND_TORSO, WIND_LEGS.A, { bob: true }),
    ],
  },
  {
    id: 'wind-blown', name: 'Wind Gnome — blown', chars: CHAR_WIND, w: 18, h: 26, fps: 12,
    note: 'Tilted downwind, arms trailing, legs streaming behind. Frames buffet on the x axis.',
    labels: ['buffet 1', 'buffet 2', 'buffet 3', 'buffet 4'],
    frames: [
      spriteFrame(WIND_BLOWN_TORSO, WIND_LEGS.Blown, {}),
      spriteFrame(WIND_BLOWN_TORSO, WIND_LEGS.Blown, { dx: 1, bob: true }),
      spriteFrame(WIND_BLOWN_TORSO, WIND_LEGS.Blown, {}),
      spriteFrame(WIND_BLOWN_TORSO, WIND_LEGS.Blown, { dx: -1, bob: true }),
    ],
  },
  {
    id: 'water-surface', name: 'Water — surface loop', chars: CHAR_WATER, w: 24, h: 24, fps: 6,
    note: 'One tile, tiles horizontally. Crests only in the top three rows; the body never moves.',
    labels: ['crest A', 'crest B'],
    frames: [waterFrame(0), waterFrame(1)],
  },
  {
    id: 'lever', name: 'Lever — off, throwing, on', chars: CHAR_PROP, w: 24, h: 24, fps: 8,
    note: 'The ball travels through 40°. Three frames is enough; the sound carries the rest.',
    labels: ['off', 'throwing', 'on'],
    frames: [leverFrame(16), leverFrame(10), leverFrame(4)],
  },
  {
    id: 'plate', name: 'Pressure plate — up, down', chars: CHAR_PROP, w: 24, h: 12, fps: 6,
    note: 'Half-tile. Drops two pixels and holds; the gold top step goes light when pressed.',
    labels: ['up', 'pressed'],
    frames: [plateFrame(false), plateFrame(true)],
  },
  {
    id: 'block', name: 'Pushable block', chars: CHAR_PROP, w: 24, h: 24, fps: 1,
    note: 'One tile. Gold outline plus corner notches so it can never read as a wall tile.',
    labels: ['static'],
    frames: [blockFrame()],
  },
  {
    id: 'exit-door', name: 'Exit door — idle glow', chars: CHAR_PROP, w: 24, h: 48, fps: 4,
    note: 'Breathing glow, brightest mid-cycle. Hold frame 1 steady while a gnome is inside.',
    labels: ['dim', 'rising', 'bright', 'falling'],
    frames: [doorFrame(0), doorFrame(1), doorFrame(2), doorFrame(3)],
  },
];

// Fail loudly on a mis-typed grid rather than rendering a silently broken sprite.
function validateSprites() {
  const errors = [];
  for (const s of SPRITE_SHEETS) {
    s.frames.forEach((f, i) => {
      if (f.length !== s.h) errors.push(`${s.id} frame ${i}: ${f.length} rows, expected ${s.h}`);
      f.forEach((row, y) => {
        if (row.length !== s.w) errors.push(`${s.id} frame ${i} row ${y}: ${row.length} px, expected ${s.w}`);
        for (const ch of row) {
          if (!(ch in s.chars)) errors.push(`${s.id} frame ${i} row ${y}: unknown char "${ch}"`);
        }
      });
    });
  }
  return errors;
}

function drawSpriteFrame(ctx, sheet, frameIndex, x, y, scale) {
  const f = sheet.frames[frameIndex];
  for (let j = 0; j < f.length; j++) {
    for (let i = 0; i < f[j].length; i++) {
      const col = sheet.chars[f[j][i]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }
  }
}

function getSpriteSheet(id) {
  return SPRITE_SHEETS.find((s) => s.id === id);
}
