# Station Quest

A text-based escape room game built with React, TypeScript, and Vite. You are trapped aboard **Station Sigma** — a sequence of six connected rooms filled with items, puzzles, and locked paths. You have **30 steps** to find your way out.

---

## Gameplay

Type commands into the input bar at the bottom of the screen. The game understands natural language and maps your words to structured actions before validating them against the actual game state.

**You win** by working through the correct sequence of rooms and puzzles and reaching the final Escape Pod.  
**You lose** if your step counter hits zero.

### Commands

| Command | Examples |
|---|---|
| `look` | `look`, `l`, `look around` |
| `go [direction]` | `go north`, `n`, `head west` |
| `take [item]` | `take keycard`, `grab the note`, `pick up fuse` |
| `use [item] on [object]` | `use keycard on card reader`, `use note on terminal` |
| `open [object]` | `open drawer`, `open console` |
| `inspect [thing]` | `inspect terminal`, `examine cabinet`, `read note` |
| `inventory` | `inventory`, `i`, `backpack` |
| `enter [code]` | `enter 7743`, `type the code` |
| `drop [item]` | `drop flashlight` |
| `help` | `help`, `?` |

Direction shortcuts: `n` `s` `e` `w`  
Arrow keys cycle through command history.

### Rules

- Every movement, item interaction, or puzzle action costs **1 step**.
- `look` and `inspect` are **free** — explore without penalty.
- You cannot take items that are not in the current room.
- You cannot use items you do not carry.
- You cannot pass through a locked exit without first unlocking it.
- Commands that attempt to alter game rules, step counts, or inventory directly are **rejected**.

---

## The Map

```
[STORAGE BAY] ──north──▶ [CORRIDOR] ──west──▶ [GENERATOR ROOM]
                              │
                            east
                              │
                              ▼
                          [LAB] ──north──▶ [CONTROL ROOM] ──east──▶ [AIRLOCK] ──north──▶ 🚀 ESCAPE
```

Each path that starts **locked** requires a specific item or puzzle solution before it opens.

---

## Architecture

The game follows a strict pipeline:

```
Player Input → Parser → Harness Validation → State Update → Result
```

| Module | Role |
|---|---|
| `src/game/parser.ts` | Converts natural language to a structured action (`TAKE: KEYCARD`, `USE: NOTE ON TERMINAL`, etc.). Rejects meta-commands. |
| `src/game/engine.ts` | The **harness**. Owns all game state. Validates every action before applying it. Rolls back on errors. The only code that can change rooms, inventory, flags, or step count. |
| `src/game/world.ts` | Static data — room descriptions, item definitions, exit configurations. Never mutated at runtime. |
| `src/App.tsx` | Three-panel UI: scrollable text log, backpack sidebar, command input. |

The parser is intentionally separate from the engine so it can be swapped for an LLM-backed interpreter without touching game logic.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Install & run

```bash
pnpm install
pnpm dev
```

Open the URL shown in the terminal (default `http://localhost:8443`).

### Build for production

```bash
pnpm build
pnpm preview
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 |
| Language | TypeScript 5.7 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Font | JetBrains Mono (Google Fonts) |
| Formatter | oxfmt |

---

## Optimal Walkthrough

<details>
<summary>Spoilers — 22-step solution</summary>

```
take keycard
take note
use keycard on card reader
go north
take fuse
use note on terminal
go west
use fuse on generator
go east
go east
open drawer
take access badge
use access badge on cabinet
take specimen jar
use access badge on door
go north
open console
take master key
use master key on door
go east
use specimen on scanner
go north
```

</details>
