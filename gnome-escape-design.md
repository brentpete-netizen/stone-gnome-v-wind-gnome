# Gnome Escape — Level 1 Design Doc

## Concept
A 2D co-op puzzle-platformer escape room, inspired by (not a copy of) *Fireboy and Watergirl*. Two gnomes with opposing elemental powers — Stone and Wind — must work together to solve environmental puzzles and escape a room/level. Built first as a single test level; future versions expand into a full map with multiple levels/rooms to progress through.

## Core Format
- **Genre:** 2D co-op puzzle-platformer, escape-room style (single enclosed level, find the exit)
- **Players:** 2 characters, controlled simultaneously by one or two players on the same keyboard
- **Controls:**
  - Player 1 (Stone Gnome): W A S D
  - Player 2 (Wind Gnome): Arrow keys
- **Goal:** Both gnomes must reach the exit together (matching the genre convention that both characters must survive and arrive at their exit points)

## Art Style
- **Pixel art**, retro 8/16-bit style
- **Setting/Theme:** Enchanted forest ruins — overgrown stone architecture reclaimed by nature, moss, vines, broken pillars, glowing magical accents

## Characters

### Stone Gnome
- Heavy — can push/move heavy blocks other characters can't budge
- Immune to spikes/sharp hazards
- Can break certain cracked/weak walls to reveal paths or shortcuts
- **Weakness:** Sinks and drowns in water — cannot cross water hazards

### Wind Gnome
- Light — can float briefly or double-jump to cross larger gaps
- Immune to fan/gust hazards that would blow other characters around
- Can glide across gaps using updrafts
- **Weakness:** Gets blown around/off course by fans and gusts (used as both a hazard and a traversal tool depending on context)

## Puzzle Mechanics (Level 1)
- **Levers & switches** — activate doors, bridges, or platforms; some require one gnome to hold a switch while the other passes through
- **Timed platforms** — platforms that move or disappear on a cycle, requiring coordinated timing between both players
- **Pressure plates / weight-based puzzles** — leverage the Stone Gnome's weight (e.g., a plate only Stone can hold down)
- **Fans/gusts** — environmental hazard for Stone Gnome, traversal tool for Wind Gnome
- **Water hazards** — impassable for Stone Gnome, safe for Wind Gnome (glide/float over)
- **Breakable walls** — Stone Gnome opens shortcuts or alternate paths for both characters
- **Cracked/weak floors** — could be a future hazard (Stone Gnome may be too heavy to cross)

## Scope for First Build
- One enclosed level/room (enchanted forest ruins theme)
- Both gnomes with their core movement + one signature ability each active
- A small set of puzzle elements to prove the mechanic loop: at least one lever/switch, one timed platform, one hazard unique to each gnome (water for Stone, fan for Wind)
- One shared exit point requiring both characters to arrive

## Future Expansion (post-first-level)
- Overworld map connecting multiple levels/rooms
- Progressive difficulty and new mechanics per level (following the "temple" structure convention — each new area introduces a new twist)
- Possible additional abilities or a third element down the line
- Level select / progression save state
