# Handoff: Gnome Escape — Levels 2–6 and the art direction

## Overview

*Gnome Escape* is a two-player, single-screen co-op puzzle-platformer. Two gnomes with
opposing elemental powers — Stone and Wind — solve one enclosed room at a time and leave
together. One playable level already exists as vanilla JS on a 2D canvas.

This bundle contains two things:

1. **Level designs for rooms 2 through 6** — layouts in tile coordinates, solution
   walkthroughs, mechanic introduction order, failure states and designer notes.
2. **An art bible** — a locked 18-colour palette, tile and sprite dimensions, per-element
   read rules, lighting model, per-room palette rotation, moment-by-moment feedback spec,
   and four shell screens.

The work to be done is: implement rooms 2–6 to these layouts, and rebuild the game's
rendering to the art direction.

## About the design files

The files in `design/` are **design references authored in HTML** — printable specification
documents, not production code. Do not copy their markup into the game. They exist so a
human can read the spec; everything a build needs is either in this README or in the two
JSON files beside it.

The existing game code is **not** in this bundle. It lives in the user's own folder
(`index.html`, `game.js`, `style.css`, `assets/`) and is the codebase to extend.

## Fidelity

**High-fidelity spec, zero finished art.** Every colour, dimension, timing and coordinate
in here is final and can be implemented literally. But no pixel art exists in this
direction yet — no tiles, no sprite sheets. Two consequences:

- Build against the palette and dimensions with flat coloured rectangles first. The art
  direction is designed so that a rectangle-only build already reads correctly; that is the
  point of it.
- The current `game.js` draws characters by playing two `.mp4` walk-cycle videos into an
  offscreen canvas and chroma-keying the background out per frame. That is a placeholder and
  should be removed once sprite sheets exist. Until then it can stay, but it will not match
  the new palette.

## Current state of the codebase

`game.js` (~630 lines, vanilla JS, no build step) already implements:

- A fixed-timestep-ish `requestAnimationFrame` loop with `dt` clamping.
- A `Player` class with axis-separated AABB collision (`resolveCollisions('x'|'y')`),
  gravity, per-character jump counts (Wind double-jumps), Wind's hold-to-glide gravity
  scaling, and block pushing gated to Stone.
- Working instances of: water (fatal to Stone), a latching lever that raises a bridge, a
  patrolling timed platform that carries riders, a cycling fan zone that shoves Stone and
  lifts Wind, a pushable block, a pressure plate, a gate, and a shared exit pad requiring
  both gnomes.
- `resetLevel()` and an R-to-reset key.

**What it does not have, and needs:** a tile grid, level data separated from code (every
piece of geometry is currently a hard-coded object literal), multiple rooms, room
transitions, a shell, sprite-sheet rendering, or any of the new mechanics.

## Build order

Do these in order. Each step leaves the game playable.

1. **Move to the tile grid.** Tile 24 px, room 20×12 tiles, internal buffer 480×288,
   presented at integer scale only (2× → 960×576). The canvas is currently 960×560 — change
   it to 960×576 so 2× is exact. Set `ctx.imageSmoothingEnabled = false` (already done) and
   round all draw positions to whole buffer pixels.
2. **Extract level data.** Replace the hard-coded `solids`, `water`, `lever`, `bridge`,
   `chasm`, `timedPlatform`, `fan`, `pushableBlock`, `plate`, `gate` and `exitZone`
   literals with a loader that reads a room definition. `levels.json` in this bundle is that
   definition for rooms 2–6, in tile coordinates. Rebuild room 1 in the same format.
3. **Apply the palette.** `palette.json` has every colour. Render everything as flat
   rectangles in these colours before any art exists. Verify the legibility rule holds: the
   only saturated pixels on screen should be hazards, interactables and the two gnomes.
4. **Add the new mechanics** in this order — each is introduced by exactly one room, so this
   order also lets you test room by room:
   - Room 2: breakable wall (Stone-only, permanent), hold-switch (recomputed from overlap
     every frame, not latched — keep the latching lever for room 1's bridge).
   - Room 3: updraft column (vertical velocity applied to Wind while inside; Stone gets
     shoved sideways instead), lever-spawned stepping stones.
   - Room 4: brittle floor (breaks under Stone with a 4-frame tip warning, intact for Wind,
     restores on reset).
   - Room 5: horizontal gust as traversal, and a block that occupies a fan's mouth tile and
     kills its airflow.
   - Room 6: paired exit doors — both occupied on the same frame, either leaving cancels.
5. **Room progression and the shell.** Title, tower-style level select, pause, room-cleared.
   All four in the same 480×288 buffer and the same palette.
6. **Feedback pass.** The table below. This is where the game stops feeling like a prototype.
7. **Art pass.** Sprite sheets to the asset list at the end.

## The core legibility rule

**The room is a silhouette. Colour means you can touch it.**

The ruins are lit from behind. Background is a bright limestone haze; all foreground
geometry is near-black ink silhouette against it. Nothing in the foreground carries colour
except interactables, hazards, and the two gnomes.

This is a legibility decision before it is a style one — two players share one screen and
read it fast. It also makes the art cheap: silhouetted stone needs no interior detail.

The trap to avoid: adding brick courses, moss or cracks in mid-ink to make silhouettes look
less flat. Every step in that direction costs legibility and gains nothing. Detail belongs
in the haze planes, where it cannot compete with the signal colours.

## Palette — 18 colours, locked

Machine-readable in `palette.json`.

### Ink — all foreground geometry
| Token | Hex | Use |
| --- | --- | --- |
| `ink.void` | `#14131f` | Voids, enclosed tile interiors, deepest |
| `ink.body` | `#1f1e2e` | Stone body — the default foreground fill |
| `ink.facet` | `#2e2c42` | Exposed top facet, 4 px |
| `ink.detail` | `#45415d` | Moss, small detail, locked UI items |

### Haze — all background
| Token | Hex | Use |
| --- | --- | --- |
| `haze.light` | `#f2e7d3` | Top band — the off-screen light source |
| `haze.near` | `#e2d3ba` | Mid band, eye level |
| `haze.far` | `#c9b79b` | Far wall |
| `haze.recess` | `#a8967d` | Bottom band, recess |

### Signal — the only saturated colour on screen
| Token | Light | Base | Reserved for |
| --- | --- | --- | --- |
| `signal.water` | `#8fd9e4` | `#4fb0c6` | Water, and nothing else |
| `signal.gust` | `#efe6ff` | `#cdbcff` | Moving air, and nothing else |
| `signal.interactive` | `#ffe6a3` | `#f0b64e` | Levers, plates, gates, block edges, timed platform edges, exits, selectable UI |
| `signal.stoneGnome` | `#f5c99b` | `#d98c53` | Stone Gnome only |
| `signal.windGnome` | `#dffff0` | `#7fe0b0` | Wind Gnome only |

Rules:

- Foreground geometry uses ink only. To make a wall read as a different material, change its
  **silhouette**, not its colour.
- Gold means a gnome can act on it. Nothing decorative is ever gold.
- The two gnome pairs are reserved. No tile, particle or UI element may use them.
- Haze steps rotate hue per room (below). Ink and signal colours never change.

## Dimensions

| | |
| --- | --- |
| Tile | 24 × 24 px |
| Room | 20 × 12 tiles, every level, no exceptions |
| Internal buffer | 480 × 288 px |
| Presentation | Integer scale only: 2× → 960 × 576, 3× → 1440 × 864. Never fractional. |
| Stone Gnome | Sprite 20 × 26 in a 32 × 32 frame, hitbox 16 × 22 |
| Wind Gnome | Sprite 18 × 26 in a 32 × 32 frame, hitbox 14 × 22 |
| Pushable block | Exactly one tile, 24 × 24 |
| Sub-tile geometry | 12 px half-tile only — ledges, plates, bridge decks |

Sprite frames are square and larger than the hitbox: art overhangs, collision does not.
Autotiling: exposed top facet in `ink.facet`, body in `ink.body`, fully enclosed interior
tiles in `ink.void`.

## Lighting model

No light source exists in the scene, so nothing casts a directional shadow and no tile needs
a lit side and a dark side. That is what keeps the tileset small.

- **Three haze planes.** Hard horizontal bands — light at top, near at eye level, recess at
  the bottom. No gradient dithering; the bands are structure, not atmosphere.
- **No parallax.** Rooms are single-screen. Depth is carried by value alone.
- **Rim light.** Every foreground silhouette gets a 4 px top facet one ink step lighter.
  That single edge is the entire lighting model.
- **Contact shadow.** Gnomes and blocks get a 2 px ink ellipse beneath them at 40% alpha.
  Nothing else does.
- **Signal glow.** Gold and violet elements bleed 1 px of their light step into surrounding
  haze. Cyan does not — water absorbs.

## What each element must read like

Shape carries identity, colour carries category, motion carries state. All three, every
time — an element that differs only by colour fails for colourblind players.

| Element | Silhouette | Colour | Motion |
| --- | --- | --- | --- |
| Solid floor | Flat top, ink body, one-tile modules | Ink only | None, ever |
| Water | Fills its basin flat to the brim | Cyan pair | Two-frame surface ripple, 6 fps |
| Void | No top facet at all — the tell | `ink.void` | None |
| Brittle floor | Top facet broken into 8 px teeth | Ink, gold hairline on teeth | Shivers 1 px when stood on |
| Cracked wall | Diagonal fracture splits the silhouette | Ink, gold fracture | Dust motes fall continuously |
| Gust / updraft | Open-ended band, never boxed | Violet pair, alpha gradient | Particles travel the full length |
| Fan housing | Blade circle in silhouette | Ink only | Blades spin when active, stop when off |
| Lever | Post and ball, taller than wide | Gold pair | Ball swings through 40° on throw |
| Pressure plate | Half-tile pad, recessed | Gold pair | Drops 2 px and holds when pressed |
| Pushable block | One tile, gold outline, ink fill | Ink + gold edge | Slides in 4 px steps, never smoothly |
| Gate | Vertical bars, floor to ceiling | Ink, gold caps | Retracts upward over 12 frames |
| Timed platform | One tile deep, gold underside | Ink + gold edge | Constant travel; underside pulses on turnaround |
| Exit door | Arch, brightest haze fill | Gold light | Slow breathing glow; steady when occupied |

## Feedback — the moment it happens

Two players are not looking at the same part of the screen, so every state change must
announce itself where it happens **and** be audible to someone looking elsewhere.

| Event | On screen | Sound |
| --- | --- | --- |
| Lever thrown | Ball swings, 3-frame gold ring at the post, the connected mechanism flashes its light step once | Wooden clack, then a low stone grind for whatever moved |
| Plate pressed | Plate drops 2 px, gold floods 8 px along the floor either side | Soft thunk with a rising tail — must sound like a latch, not a footstep |
| Block pushed | 4 px stepped slide, dust puff at the base each step | Grit scrape, pitch tied to distance travelled |
| Wall broken | Silhouette shatters into 6 ink chunks, falling and fading over 20 frames | Dry crack plus rubble tail. The most satisfying sound in the game. |
| Gust entered | Particles bend around the gnome; Wind's sprite tilts 8° downwind | Airy hiss that gains a whistle while a body is inside |
| Stone drowns | Cyan splash ring, sprite sinks 12 px over 8 frames, screen dims 15% for 6 frames | Heavy plunge, muffled tail. No sting, no jingle — the room should feel quiet after. |
| Brittle floor gives | Slab tips before it falls: 4 frames of warning where a jump still saves you | Sharp splinter crack on the tip, not on the fall |
| Reset | Wipe from both screen edges inward over 10 frames. Never a fade — a fade reads as a bug. | Short reversed whoosh |
| One gnome in a door | Door glow goes steady, gold pip lights on that gnome's HUD tag | Single held note, one of two in a chord |
| Both in — solved | The two notes resolve, gold floods outward from both doors, silhouettes lift toward the haze for 30 frames | The chord completes |

**The two-note rule.** Each exit door owns one note of a two-note chord. A player standing
in their door alone hears their note held, unresolved — the clearest possible instruction to
the other player without a line of text. Everything else in the audio design can be cheap;
this cannot.

## Per-room palette rotation

Six distinct rooms from one tileset: rotate the four haze steps, leave everything else alone.
In practice that is four hex values per room in the level data. Values in `palette.json`
under `hazePerRoom`.

| Room | Haze | Reads as |
| --- | --- | --- |
| 1 · Overgrown Ruins | Warm bone, the base four steps | Late afternoon, ground level |
| 2 · The Cracked Vault | Hue −20°, chroma −30% | Sealed, airless, colder |
| 3 · Updraft Shaft | Toward aqua, lightness +6% | Open to the sky above |
| 4 · Brittle Causeway | Toward dusk rose | High up, thinner air |
| 5 · Crosswind Gallery | Toward gold, lightness +10% | Bright, exposed, windswept |
| 6 · The Two Doors | **Inverted** — deep indigo haze, ink lifted two steps | Night, interior, final |

Room 6 is the only place the rule bends, and it does so deliberately: the silhouettes read
lighter than their background for the first time, and the game says out loud that this is the
last room.

## The rooms

Coordinates are tiles. Origin top-left, columns 0–19, rows 0–11, ranges inclusive. Rows
10–11 are the standard floor band unless a room says otherwise. Beat numbers key to the
walkthroughs. Machine-readable in `levels.json`.

### Room 2 · The Cracked Vault
*New: breakable walls, hold-switch. Returns: plate + block.*

A sealed antechamber. Establishes that Stone opens geometry, and that a switch can need a
body left behind on it. Ends by teaching the latch — a block on a plate holds open what a
gnome cannot stay to hold.

Floor: solid, cols 0–19, rows 10–11.

| Element | Position |
| --- | --- |
| Stone start | col 1, row 9 |
| Wind start | col 2, row 9 |
| Cracked wall ① | col 6, rows 5–9 |
| Hold-switch ② | col 11, row 9 |
| Gate ③ | col 14, rows 5–9 |
| Pushable block | col 15, row 9 |
| Pressure plate ④ | col 17, row 9 |
| Exit | cols 18–19, rows 8–9 |

**Solution.** ① Stone breaks the cracked wall; Wind cannot. ② Both cross; Wind stands on the
hold-switch, which raises the gate only while weight is on it. ③ Stone passes through. ④
Stone pushes the block onto the plate, latching the gate open permanently; Wind steps off,
crosses, and both exit.

**Why it holds.** The naive attempt is Stone on the switch and Wind through the gate — which
fails, because Wind cannot move the block. The failure is instant, legible and costs four
seconds, so players reason their way to the right assignment rather than guessing.

**Failure states.** None fatal. No water, no void, no gust. The only cost is walking back.

### Room 3 · Updraft Shaft
*New: updraft column, glide to ledge. Returns: water, lever.*

The first room where Wind goes somewhere Stone cannot follow and comes back with a path.

Floor: cols 0–4 rows 10–11; cols 11–14 rows 10–11; raised east floor cols 15–19 rows 8–11.

| Element | Position |
| --- | --- |
| Stone start | col 1, row 9 |
| Wind start | col 2, row 9 |
| Water | cols 5–10, rows 10–11 |
| Fan housing (up) | cols 6–7, row 9 |
| Updraft column ① | cols 6–7, rows 4–9 |
| High ledge | cols 8–12, row 3 |
| Lever ② | col 10, row 2 |
| Stepping stones ③ | cols 5, 7, 9 at row 9 — absent until the lever is thrown |
| Exit ④ | cols 17–18, rows 6–7 |

**Solution.** ① Wind jumps out over the pool into the updraft, which carries it above the
water; Stone entering the same column is shoved sideways into the pool. ② Wind glides off the
top onto the high ledge and throws the lever. ③ Three stepping stones drop into the pool;
Stone crosses on them. ④ Both climb the raised east floor — Stone by jump, Wind by glide.

**Tuning.** Column height must put Wind's apex slightly *above* the ledge, not level with it,
so the landing is forgiving: roughly 130–140 px of lift over a two-tile-wide column at the
current jump and glide values.

**Failure states.** Stone drowning, and it should be easy to trigger early — the pool is wide
and close to the start. Losing Stone to the water in the first ten seconds is the fastest way
to teach the rule.

**If it stalls in playtest,** widen the east ledge's approach rather than lowering the
column. Players read a missed jump as their own mistake and a missed updraft as the game's.

### Room 4 · Brittle Causeway
*New: cracked floors. Returns: timed platform, lever.*

Both gnomes cross the same chasm at the same time by different routes.

Floor: cols 0–4 rows 10–11; cols 15–19 rows 10–11. Void: cols 5–14, rows 10–11.

| Element | Position |
| --- | --- |
| Stone start | col 1, row 9 |
| Wind start | col 2, row 9 |
| Teaching slab | col 3, row 9 — one brittle slab over a shallow one-tile pit, harmless |
| Brittle causeway ① | cols 5–14, row 7 |
| Lever ② | col 16, row 9 |
| Timed platform ③ | 3 tiles wide, row 10, travelling cols 5 → 12 |
| Exit ④ | cols 18–19, rows 8–9 |

**Solution.** ① Wind double-jumps onto the brittle causeway and runs it; the slabs hold, with
a faint crack under each step so the material still reads as unsafe. ② Wind reaches the east
floor and throws the lever, starting the platform's cycle. ③ Stone boards at the west edge,
rides across, steps off before it reverses. ④ Both exit. If Stone touches the causeway, the
slab it lands on falls away and Stone follows it into the void.

**Teaching the material.** The col-3 slab is the whole lesson: Stone breaks it, drops a
body-height, climbs out unharmed. Costs nothing there and everything on the causeway.

**Timing.** Platform travel must be slow enough that a missed boarding just means waiting for
the next pass. Nothing here should demand a frame-accurate step — the pressure is
coordination, not reflex.

**Respawn.** Broken slabs restore on reset. The void must reset the level rather than trap:
there is no path back up from it.

### Room 5 · Crosswind Gallery
*New: gust as traversal, block as windbreak. Returns: bridge lever, plate.*

The same gust is Wind's only way across and the reason Stone cannot cross. The first room
where doing the right things in the wrong order forces a reset.

Floor: cols 0–7 rows 10–11; cols 12–19 rows 10–11. Void: cols 8–11, rows 10–11.

| Element | Position |
| --- | --- |
| Stone start | col 1, row 9 |
| Wind start | col 2, row 9 |
| Fan 1 housing (right) | col 6, row 9 |
| Gust 1 ① | cols 7–11, row 9 |
| Lever ② | col 5, row 9 — raises the bridge |
| Bridge | cols 8–11, row 10 — absent until the lever is thrown |
| Block 1 ③ | starts col 3, row 9 — plugs the fan mouth at col 7, row 9 |
| Fan 2 housing (right) | col 14, row 5 |
| Gust 2 ④ | cols 15–19, row 5 |
| Exit ledge | cols 17–19, row 6 |
| Block 2 | starts col 13, row 9 |
| Pressure plate | col 16, row 9 — switches fan 2 off |
| Exit | cols 18–19, rows 4–5 |

**Solution.** ① Wind goes first, riding gust 1 across the void to the east floor. This must
happen before anything else is touched. ② Stone throws the lever, raising the bridge — but
gust 1 blows Stone off it, so Stone pushes block 1 into the fan's mouth, killing the airflow.
③ With the gust dead, Stone walks the bridge across. ④ Wind cannot stand on the exit ledge
while gust 2 blows across it; Stone pushes block 2 onto the plate, gust 2 stops, both exit.

**The trap, on purpose.** A player who plugs gust 1 before Wind has crossed strands Wind on
the west side with no route. That is the intended lesson of the room, and it must be
recoverable in one keystroke — R resets instantly, and the reset message names the cause:
*"Wind Gnome has no way across."*

**Read the wind.** Both gusts need constant particle flow even while inert, so a plugged fan
is visibly plugged rather than ambiguously broken. Gust 2 keeps a stub of particles behind
the block.

**Cut if it drags.** Drop block 2 and the plate, and let gust 2 pulse on room 1's on/off
cycle instead — Wind then times its arrival. Keeps the beat, halves the solve.

### Room 6 · The Two Doors
*Finale. Introduces nothing; returns everything.*

A pillar splits the room and each gnome starts on the wrong side of it. Two exits, one per
gnome, and they only count when both are occupied at once.

**Floor is row 10 only in this room.** Row 11 is the tunnel band.

| Element | Position |
| --- | --- |
| Wind start | col 1, row 9 (west) |
| Stone start | col 14, row 9 (east) |
| West floor | cols 0–8, row 10 |
| East floor | cols 10–19, row 10 |
| Pillar | col 9, rows 0–3 and 6–11 — window at rows 4–5, passable by Wind only |
| Water | cols 3–6, row 10 |
| West ledges | col 2 row 8; cols 4–7 row 5 |
| Stone's exit | cols 0–1, rows 8–9 |
| Cracked wall ① | col 13, rows 5–9 — reveals the tunnel mouth |
| Tunnel ② | cols 7–13, row 11 |
| Shaft | col 7, rows 10–11 — **open question**, see below |
| Brittle causeway ③ | cols 14–17, row 7 |
| Wind's exit ④ | cols 18–19, rows 8–9 |

**Solution.** ① Stone, on the east side, breaks the cracked wall, revealing the mouth of the
tunnel that runs under the pillar. ② Stone takes the tunnel west and climbs the shaft onto
the west floor, beyond the water. ③ Wind climbs the west ledges over the water, glides through
the pillar window to the east side, and crosses the brittle causeway. ④ Stone stands in the
west door, Wind in the east door. Both must be occupied on the same frame; either gnome
leaving cancels.

**The swap.** Nothing new is taught. The difficulty is entirely in the starting positions —
each gnome begins in the half designed against it, so the first thirty seconds are spent
reading the room rather than moving through it.

**Two doors, one condition.** The paired-exit check replaces the shared exit pad from rooms
1–5. Both doors light and hum while occupied so a waiting player can see their partner is not
yet in place.

**Sightlines.** The pillar must not hide either gnome. Keep it one tile wide, and if the
window and the tunnel both sit behind it, thin it to a colonnade rather than a solid slab —
players need to watch each other work.

**Open question.** The tunnel's west shaft is unresolved: a climbable shaft, a one-way
updraft, or a second cracked wall. A shaft is simplest but gives Stone a vertical move it has
nowhere else in the game.

## Room 1

Room 1 exists and is playable, but it teaches five mechanics in one screen. The design
recommendation is to cut the timed platform and the plate-and-block sequence out of it, leaving
water, the lever bridge and the gust — the two cut pieces are re-taught with room to breathe
in rooms 4 and 2. That gives the opening room a clean three-beat rhythm instead of five.

**This is now decided — trim it.** See Decisions above.

## The shell

Four screens, all in the same 480×288 buffer and the same palette as the game. The shell never
switches to a different visual language: ink silhouette, haze ground, gold for anything
selectable. See `design/Gnome Escape Art Bible.dc.html` section 8 for layout diagrams.

- **Title.** Wordmark flush left in ink on haze; a silhouetted ruin edge along the bottom; the
  two gnomes standing small and in-world rather than posed as mascots. `▸ PRESS START` in gold.
  No menu until Start is pressed.
- **Level select — the tower.** The six rooms as rungs on a tower climbed bottom to top. Gold
  rung is where you are, ink rungs are cleared, `ink.detail` rungs are locked. Room name in
  gold to the side of the current rung.
- **Pause.** The room stays visible behind an ink veil at 72% alpha, both gnomes frozen
  mid-pose. `▸ RESUME` in gold; `RESTART ROOM · R` and `THE TOWER` in haze.
- **Room cleared.** The only centred screen and the only one where haze floods the frame. Room
  name, time, reset count, `▸ NEXT ROOM`.

### HUD

There is almost none, and that is the point. Two tags in the top corners, 20 px tall, each
carrying its gnome's colour swatch, its control scheme, and a door pip that lights when that
gnome is in position. Nothing else — no timer, no counter, no ability icons. If a mechanic
needs a HUD element to be understood, the mechanic needs redesigning.

## Controls

| | |
| --- | --- |
| Stone Gnome | W jump, A/D move |
| Wind Gnome | ↑ jump (double), ←/→ move, hold ↑ while falling to glide |
| Reset room | R |

## Asset list

Everything the six rooms need. If it is not on this list, the rooms do not need it.

| Asset | Frames | Size |
| --- | --- | --- |
| Stone Gnome — idle ✅, walk ✅, push ✅, break, sink | 2 / 6 / 4 / 5 / 8 | 20 × 26 in a 32 × 32 frame |
| Wind Gnome — idle ✅, walk ✅, blown ✅, jump, glide | 2 / 6 / 4 / 3 / 2 | 18 × 26 in a 32 × 32 frame |
| Stone tileset — autotile, 16 cases | 1 each | 24 × 24 |
| Brittle floor — whole, shivering, tipping, gone | 1 / 2 / 4 / 1 | 24 × 24 |
| Cracked wall — whole, shatter | 1 / 6 | 24 × 48 |
| Water — surface loop ✅, splash | 2 / 5 | 24 × 24 / 32 × 32 |
| Fan housing — spin loop, stopped | 4 / 1 | 48 × 48 |
| Gust particle | 3 | 4 × 12 |
| Lever — off ✅, throwing ✅, on ✅ | 3 | 24 × 24 |
| Plate — up ✅, down ✅ | 2 | 24 × 12 |
| Pushable block ✅ | 1 | 24 × 24 |
| Gate — closed, retracting, open | 1 / 4 / 1 | 24 × 120 |
| Timed platform | 1 | 72 × 24 |
| Exit door — idle glow ✅, occupied, opening | 4 / 1 / 6 | 24 × 48 |
| Dust puff, rubble chunk, splash ring | 4 / 3 / 5 | 16 × 16 |
| Wordmark | 1 | Bitmap, 5 × 7 base glyph |
| UI font | Full ASCII | 5 × 7 bitmap, 1 px spacing |

✅ = hand-authored in \`sprites.js\`. Everything else is still to draw.

The font is settled at 40 glyphs — see Decisions above.

## Decisions

These were open in draft 1 and are now settled. Build to these.

### Room 1 gets trimmed
Room 1 keeps water, the lever bridge and the gust. **Cut the timed platform and the
plate-and-block sequence from it** — they are re-taught with room to breathe in rooms 4 and 2.
The opening room becomes three beats instead of five.

### Shared exit pad is the standard; paired doors are room 6 only
Rooms 1–5 use one shared exit pad that both gnomes must stand on. Room 6 introduces paired
doors — one per gnome, both occupied on the same frame — as the finale twist. Do not
retrofit paired doors onto rooms 1–5.

Consequence worth knowing: room 6 is then teaching a new win condition in the last room. That
is deliberate, but it means room 6's two doors must be visually unmistakable — each door
tinted with its gnome's own colour rather than generic gold, so a player reads "that one is
mine" without instruction.

### Room 6's palette inversion: keep it
The deep-indigo haze stays. It costs four hex values in the level data and it is the only
structural signal the game has that this is the last room.

One constraint on it: **the signal colours do not change.** Water stays cyan, gust stays
violet, interactables stay gold, the gnomes stay sandstone and mint. Only the four haze steps
invert. Every read the player learned in rooms 1–5 still holds; what changes is the ground
they read it against.

### Room 6's west shaft: a stair, not a shaft
None of the three original options. Build the tunnel's west end as a **two-tile stair up to
the west floor** — tiles at (7, 11) and (8, 11) rising to floor level at row 10.

Reasoning: a climbable shaft gives Stone a vertical verb used exactly once in the whole game,
and a second cracked wall repeats beat 1 inside the same room. A stair is pure geometry — no
new mechanic, no repeated beat, nothing to teach. Update `levels.json`: the `shaft` element
in room 6 becomes `{ "type": "stair", "cols": [7, 8], "row": 11, "risesTo": 10 }`.

### Room 5 keeps no undo — it gets a stranded-detector instead
**Do not make blocks pullable.** Pulling removes the ordering lesson, which is the entire
reason room 5 exists.

Instead: when Wind has no reachable route to the exit — plugged fan, no bridge, no gust — the
game detects it and surfaces the reset prompt after three seconds, naming the cause:
*"Wind Gnome has no way across. R to reset."* The player keeps the lesson and loses the dead
time spent discovering they are stuck. A cheap reachability check on the four or five
traversal edges in the room is enough; this does not need a general pathfinder.

### The bitmap font: 40 glyphs, not full ASCII
Do not build a full ASCII 5×7 font. Build only the glyphs the game actually renders:

`A–Z` (26) · `0–9` (10) · space · `·` · `▸` · `—`

That is 40 glyphs. All UI copy is uppercase, which the shell screens already assume. If a
string later needs a glyph outside the set, add that one glyph rather than the alphabet
around it. Render at exactly 8 px or 16 px, never scaled between.

## Files in this bundle

| File | What it is |
| --- | --- |
| `README.md` | This brief. Self-sufficient — everything needed to build is here. |
| `levels.json` | Rooms 2–6 in tile coordinates, machine-readable. |
| `palette.json` | The 18 colours, per-room haze rotation, and grid dimensions. |
| `design/Gnome Escape Level Design Doc.dc.html` | The level design document, for reading. Open in a browser. |
| `design/Gnome Escape Art Bible.dc.html` | The art bible, for reading. Open in a browser. |
| `design/doc-page.js`, `design/support.js`, `design/_ds/` | Runtime the two HTML documents need in order to render. Not game code. |
| `reference/` | The user's original art references — the previous mossy grey-stone direction, superseded by the art bible but useful for setting and character read. |
