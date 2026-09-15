import { ROOMS, ITEMS } from "./world";
import type { ParsedAction } from "./parser";

// ─── State ───────────────────────────────────────────────────────────────────

export interface GameState {
  currentRoomId: string;
  inventory: string[];          // item ids
  roomItems: Record<string, string[]>; // roomId → item ids present
  unlockedExits: string[];      // "roomId:direction"
  openedObjects: string[];      // "roomId:objectId" already opened
  flags: string[];              // named game-state flags
  steps: number;
  maxSteps: number;
  won: boolean;
  lost: boolean;
}

export interface EngineResult {
  newState: GameState;
  messages: string[];
  costStep: boolean;
  valid: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasFlag(s: GameState, flag: string): boolean {
  return s.flags.includes(flag);
}

function hasItem(s: GameState, itemId: string): boolean {
  return s.inventory.includes(itemId);
}

function isExitUnlocked(s: GameState, roomId: string, dir: string): boolean {
  if (s.unlockedExits.includes(`${roomId}:${dir}`)) return true;
  const room = ROOMS[roomId];
  const exit = room?.exits.find((e) => e.direction === dir);
  return exit ? !exit.locked : false;
}

function unlockExit(s: GameState, roomId: string, dir: string): GameState {
  const key = `${roomId}:${dir}`;
  if (s.unlockedExits.includes(key)) return s;
  return { ...s, unlockedExits: [...s.unlockedExits, key] };
}

function addFlag(s: GameState, flag: string): GameState {
  if (s.flags.includes(flag)) return s;
  return { ...s, flags: [...s.flags, flag] };
}

function markOpened(s: GameState, key: string): GameState {
  if (s.openedObjects.includes(key)) return s;
  return { ...s, openedObjects: [...s.openedObjects, key] };
}

function addToInventory(s: GameState, itemId: string): GameState {
  if (s.inventory.includes(itemId)) return s;
  return { ...s, inventory: [...s.inventory, itemId] };
}

function removeFromInventory(s: GameState, itemId: string): GameState {
  return { ...s, inventory: s.inventory.filter((id) => id !== itemId) };
}

function removeFromRoom(s: GameState, roomId: string, itemId: string): GameState {
  return {
    ...s,
    roomItems: {
      ...s.roomItems,
      [roomId]: (s.roomItems[roomId] ?? []).filter((id) => id !== itemId),
    },
  };
}

function addToRoom(s: GameState, roomId: string, itemId: string): GameState {
  const current = s.roomItems[roomId] ?? [];
  if (current.includes(itemId)) return s;
  return { ...s, roomItems: { ...s.roomItems, [roomId]: [...current, itemId] } };
}

function deductStep(s: GameState): GameState {
  const steps = s.steps - 1;
  return { ...s, steps, lost: steps <= 0 && !s.won };
}

/** Find item id in a list by fuzzy match on id or name */
function findItem(ids: string[], query: string): string | undefined {
  const q = query.toLowerCase();
  return ids.find((id) => {
    if (id === q) return true;
    const item = ITEMS[id];
    if (!item) return false;
    return (
      item.name.toLowerCase() === q ||
      item.name.toLowerCase().replace(/\s+/g, "_") === q ||
      id.toLowerCase().includes(q) ||
      q.includes(id.toLowerCase()) ||
      item.name.toLowerCase().includes(q.replace(/_/g, " "))
    );
  });
}

// ─── Initial State ────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  const roomItems: Record<string, string[]> = {};
  for (const [id, room] of Object.entries(ROOMS)) {
    roomItems[id] = [...room.items];
  }
  return {
    currentRoomId: "storage_bay",
    inventory: [],
    roomItems,
    unlockedExits: [],
    openedObjects: [],
    flags: [],
    steps: 30,
    maxSteps: 30,
    won: false,
    lost: false,
  };
}

// ─── Room Description ─────────────────────────────────────────────────────────

export function describeRoom(s: GameState): string[] {
  const room = ROOMS[s.currentRoomId];
  const lines: string[] = [];
  lines.push(`▸ ${room.name}`);
  lines.push(room.description);

  const items = s.roomItems[s.currentRoomId] ?? [];
  if (items.length > 0) {
    const names = items.map((id) => ITEMS[id]?.name ?? id).join("  |  ");
    lines.push(`Items here: ${names}`);
  }

  const exitList = room.exits.map((e) => {
    const unlocked = isExitUnlocked(s, s.currentRoomId, e.direction);
    return `${e.direction.toUpperCase()}${unlocked ? "" : " [LOCKED]"}`;
  });
  if (exitList.length > 0) {
    lines.push(`Exits: ${exitList.join("  |  ")}`);
  }

  return lines;
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

export function processAction(state: GameState, action: ParsedAction): EngineResult {
  // Snapshot for rollback if something goes wrong
  const snapshot = state;

  if (state.won || state.lost) {
    return { newState: state, messages: ["The game is over. Reload to play again."], costStep: false, valid: false };
  }

  let s = state;
  const messages: string[] = [];

  // Show parsed interpretation (dimmed in UI)
  messages.push(`${action.display}`);

  try {
    switch (action.action) {
      case "LOOK":
        return handleLook(s, messages);

      case "INVENTORY": {
        if (s.inventory.length === 0) {
          messages.push("Your backpack is empty.");
        } else {
          const names = s.inventory.map((id) => ITEMS[id]?.name ?? id).join(", ");
          messages.push(`Backpack: ${names}`);
        }
        return { newState: s, messages, costStep: false, valid: true };
      }

      case "HELP": {
        messages.push(
          "Commands:",
          "  go [north|south|east|west]   — move through exits",
          "  take [item]                  — pick up an item",
          "  use [item] on [object]       — interact with environment",
          "  open [object]               — open a container or door",
          "  inspect [thing]             — examine something closely",
          "  look                        — describe current room",
          "  inventory / i               — list backpack contents",
          "Shortcuts: n s e w | Direction keys work too.",
        );
        return { newState: s, messages, costStep: false, valid: true };
      }

      case "INSPECT":
        return handleInspect(s, action.subject ?? "", messages);

      case "MOVE":
        return handleMove(s, action.subject ?? "", messages);

      case "TAKE":
        return handleTake(s, action.subject ?? "", messages);

      case "DROP":
        return handleDrop(s, action.subject ?? "", messages);

      case "OPEN":
        return handleOpen(s, action.subject ?? "", messages);

      case "USE":
        return handleUse(s, action.instrument, action.subject ?? "", messages);

      case "ENTER_CODE":
        return handleEnterCode(s, action.subject, messages);

      case "UNKNOWN":
      default:
        messages.push(
          action.display.startsWith("REJECTED")
            ? "That command cannot alter the game state."
            : "Command not understood. Type 'help' for a list of valid commands.",
        );
        return { newState: s, messages, costStep: false, valid: false };
    }
  } catch {
    // Restore snapshot on any unexpected error
    return {
      newState: snapshot,
      messages: ["Something went wrong. State restored."],
      costStep: false,
      valid: false,
    };
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleLook(s: GameState, messages: string[]): EngineResult {
  messages.push(...describeRoom(s));
  return { newState: s, messages, costStep: false, valid: true };
}

function handleInspect(s: GameState, subj: string, messages: string[]): EngineResult {
  const room = ROOMS[s.currentRoomId];

  // Room object
  const obj = room.objects.find(
    (o) => o.id === subj || o.name.toLowerCase().replace(/\s+/g, "_") === subj,
  );
  if (obj) {
    messages.push(obj.description);
    // Contextual hints
    if (obj.id === "terminal" && s.currentRoomId === "corridor") {
      messages.push(
        hasFlag(s, "lab_unlocked")
          ? "The terminal reads: \"ACCESS GRANTED.\""
          : "Hint: use the note on the terminal, or type the override code directly.",
      );
    }
    if (obj.id === "console" && s.currentRoomId === "control_room") {
      messages.push(
        hasFlag(s, "power_on")
          ? "The console is powered up. Try opening it."
          : "The console is dark. You need to restore generator power first.",
      );
    }
    return { newState: s, messages, costStep: false, valid: true };
  }

  // Item in room or inventory
  const allAvail = [...(s.roomItems[s.currentRoomId] ?? []), ...s.inventory];
  const itemId = findItem(allAvail, subj);
  if (itemId) {
    messages.push(ITEMS[itemId]?.description ?? "Nothing special.");
    return { newState: s, messages, costStep: false, valid: true };
  }

  messages.push(`You don't see a ${subj.replace(/_/g, " ")} here.`);
  return { newState: s, messages, costStep: false, valid: false };
}

function handleMove(s: GameState, dir: string, messages: string[]): EngineResult {
  const room = ROOMS[s.currentRoomId];
  const exit = room.exits.find((e) => e.direction === dir);

  if (!exit) {
    messages.push(`There is no exit to the ${dir} from here.`);
    return { newState: s, messages, costStep: false, valid: false };
  }

  if (!isExitUnlocked(s, s.currentRoomId, dir)) {
    messages.push(exit.lockedMessage ?? `The way ${dir} is locked.`);
    return { newState: s, messages, costStep: false, valid: false };
  }

  let ns = deductStep(s);
  ns = { ...ns, currentRoomId: exit.roomId };

  if (exit.roomId === "escape") {
    ns = { ...ns, won: true };
    messages.push(
      "▸ — FREEDOM —",
      "",
      "The outer door hisses open. Cold air rushes into the airlock.",
      "You climb into the emergency escape pod and hit the launch sequence.",
      "Countdown. Thrusters. Through the porthole, Station Sigma shrinks",
      "into a pale dot against a sea of stars.",
      "",
      "✦  YOU ESCAPED.  STATION QUEST COMPLETE.  ✦",
      `Escaped in ${ns.maxSteps - ns.steps} steps.`,
    );
    return { newState: ns, messages, costStep: true, valid: true };
  }

  messages.push(...describeRoom(ns));
  return { newState: ns, messages, costStep: true, valid: true };
}

function handleTake(s: GameState, subj: string, messages: string[]): EngineResult {
  const roomId = s.currentRoomId;
  const roomItemIds = s.roomItems[roomId] ?? [];

  const itemId = findItem(roomItemIds, subj);
  if (!itemId) {
    const alreadyOwn = findItem(s.inventory, subj);
    if (alreadyOwn) {
      messages.push(`You already have the ${ITEMS[alreadyOwn]?.name ?? alreadyOwn}.`);
    } else {
      messages.push(
        `There is no ${subj.replace(/_/g, " ")} here to take.`,
      );
    }
    return { newState: s, messages, costStep: false, valid: false };
  }

  let ns = deductStep(s);
  ns = removeFromRoom(ns, roomId, itemId);
  ns = addToInventory(ns, itemId);
  messages.push(`You take the ${ITEMS[itemId].name}.  → Added to backpack.`);
  return { newState: ns, messages, costStep: true, valid: true };
}

function handleDrop(s: GameState, subj: string, messages: string[]): EngineResult {
  const itemId = findItem(s.inventory, subj);
  if (!itemId) {
    messages.push(`You don't have a ${subj.replace(/_/g, " ")} in your backpack.`);
    return { newState: s, messages, costStep: false, valid: false };
  }

  let ns = deductStep(s);
  ns = removeFromInventory(ns, itemId);
  ns = addToRoom(ns, ns.currentRoomId, itemId);
  messages.push(`You drop the ${ITEMS[itemId].name}.`);
  return { newState: ns, messages, costStep: true, valid: true };
}

function handleOpen(s: GameState, subj: string, messages: string[]): EngineResult {
  const roomId = s.currentRoomId;

  // ── Lab ──────────────────────────────────────────────────────────────────
  if (roomId === "lab") {
    if (subj === "drawer" || subj === "workbench_drawer" || subj === "workbench") {
      const key = "lab:drawer";
      if (s.openedObjects.includes(key)) {
        messages.push("The drawer is already open.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = markOpened(ns, key);
      ns = addToRoom(ns, "lab", "access_badge");
      messages.push(
        "You pull the drawer open.",
        "Half-buried under scattered papers — Dr. Chen's lab access badge.",
        "ACCESS BADGE  →  Now in the room. Take it.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }

    if (subj === "cabinet" || subj === "specimen_cabinet") {
      if (!hasItem(s, "access_badge")) {
        messages.push(
          "The specimen cabinet has a badge scanner. You need an access badge.",
        );
        return { newState: s, messages, costStep: false, valid: false };
      }
      if (hasFlag(s, "cabinet_opened")) {
        messages.push("The cabinet is already open.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = addFlag(ns, "cabinet_opened");
      ns = addToRoom(ns, "lab", "specimen");
      messages.push(
        "You swipe Dr. Chen's badge across the scanner.  Amber → GREEN.",
        "The cabinet clicks open. Inside: a sealed SPECIMEN JAR pulsing blue.",
        "SPECIMEN JAR  →  Now in the room. Take it.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // ── Control Room ──────────────────────────────────────────────────────────
  if (roomId === "control_room") {
    if (subj === "console" || subj === "control_console") {
      if (!hasFlag(s, "power_on")) {
        messages.push(
          "The console is locked and dark. It requires main power.",
          "Hint: the generator room has an empty fuse slot.",
        );
        return { newState: s, messages, costStep: false, valid: false };
      }
      if (hasFlag(s, "console_opened")) {
        messages.push("The console is already open.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = addFlag(ns, "console_opened");
      ns = addToRoom(ns, "control_room", "master_key");
      messages.push(
        "Power courses through the console. Panels light up. A compartment pops open.",
        'Inside: a heavy brass MASTER KEY engraved "AIRLOCK — EMERGENCY USE ONLY."',
        "MASTER KEY  →  Now in the room. Take it.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // Generic case: door already unlocked?
  if (subj === "door") {
    const room = ROOMS[roomId];
    const firstLocked = room.exits.find(
      (e) => e.locked && !isExitUnlocked(s, roomId, e.direction),
    );
    if (firstLocked) {
      messages.push(
        firstLocked.lockedMessage ?? "The door is locked.",
      );
    } else {
      messages.push("The doors here are already unlocked.");
    }
    return { newState: s, messages, costStep: false, valid: false };
  }

  messages.push(
    `You can't open the ${subj.replace(/_/g, " ")} here, or it doesn't need to be opened that way.`,
  );
  return { newState: s, messages, costStep: false, valid: false };
}

function handleUse(
  s: GameState,
  instrument: string | undefined,
  subject: string,
  messages: string[],
): EngineResult {
  const roomId = s.currentRoomId;

  // USE without instrument — guide the player
  if (!instrument) {
    messages.push(
      `What would you like to use ${subject.replace(/_/g, " ")} on?`,
      "Format: use [item] on [object]",
    );
    return { newState: s, messages, costStep: false, valid: false };
  }

  // Validate instrument is in inventory
  const instrId = findItem(s.inventory, instrument);
  if (!instrId) {
    messages.push(
      `You don't have a ${instrument.replace(/_/g, " ")} in your backpack.`,
    );
    return { newState: s, messages, costStep: false, valid: false };
  }

  const instrName = ITEMS[instrId]?.name ?? instrId;

  // ── Storage Bay ───────────────────────────────────────────────────────────
  if (roomId === "storage_bay") {
    if (
      instrId === "keycard" &&
      (subject === "card_reader" || subject === "door" || subject === "reader" || subject === "slot" || subject === "north")
    ) {
      if (isExitUnlocked(s, "storage_bay", "north")) {
        messages.push("The card reader is already green. The north door is open.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = unlockExit(ns, "storage_bay", "north");
      messages.push(
        "You swipe the keycard through the reader.  BEEP.",
        "Indicator: RED → GREEN.",
        "The north door unlocks with a heavy thunk.  You can go NORTH.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // ── Corridor ──────────────────────────────────────────────────────────────
  if (roomId === "corridor") {
    const onTerminal =
      subject === "terminal" ||
      subject === "keypad" ||
      subject === "screen" ||
      subject === "computer";

    if (instrId === "note" && onTerminal) {
      if (hasFlag(s, "lab_unlocked")) {
        messages.push('The terminal reads: "ACCESS GRANTED." The lab is already open.');
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = addFlag(ns, "lab_unlocked");
      ns = unlockExit(ns, "corridor", "east");
      messages.push(
        "You read the code from the note and enter: 7-7-4-3.",
        '"OVERRIDE ACCEPTED.  LAB ACCESS GRANTED."',
        "The east door unlocks.  You can go EAST.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // ── Generator Room ────────────────────────────────────────────────────────
  if (roomId === "generator_room") {
    if (
      instrId === "fuse" &&
      (subject === "generator" || subject === "panel" || subject === "breaker_panel" || subject === "breaker" || subject === "fuse_slot" || subject === "slot")
    ) {
      if (hasFlag(s, "power_on")) {
        messages.push("The fuse is already installed. Power is on.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = removeFromInventory(ns, "fuse"); // fuse is permanently installed
      ns = addFlag(ns, "power_on");
      messages.push(
        "You slot the fuse into the empty socket.  CLICK.",
        "The generators cough — then roar to life.",
        "Overhead lights flicker on across the station.",
        "Power restored.  Something deep in the control room hums awake.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // ── Lab ───────────────────────────────────────────────────────────────────
  if (roomId === "lab") {
    const onCabinet =
      subject === "cabinet" || subject === "specimen_cabinet" || subject === "locker" || subject === "safe";
    const onDoor =
      subject === "door" || subject === "north_door" || subject === "scanner" || subject === "north" || subject === "badge_scanner";

    if (instrId === "access_badge" && onCabinet) {
      if (hasFlag(s, "cabinet_opened")) {
        messages.push("The cabinet is already open.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = addFlag(ns, "cabinet_opened");
      ns = addToRoom(ns, "lab", "specimen");
      messages.push(
        "You swipe Dr. Chen's badge.  Amber → GREEN.",
        "The cabinet clicks open.  Inside: a sealed SPECIMEN JAR pulsing with blue light.",
        "SPECIMEN JAR  →  Now in the room. Take it.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }

    if (instrId === "access_badge" && onDoor) {
      if (isExitUnlocked(s, "lab", "north")) {
        messages.push("The north door is already unlocked.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = unlockExit(ns, "lab", "north");
      messages.push(
        'You press Dr. Chen\'s badge to the north door scanner.  GREEN light.',
        '"LEVEL 3 ACCESS GRANTED."',
        "The control room door unlocks.  You can go NORTH.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // ── Control Room ──────────────────────────────────────────────────────────
  if (roomId === "control_room") {
    const onDoor =
      subject === "door" || subject === "east_door" || subject === "airlock" || subject === "east" || subject === "keyhole";

    if (instrId === "master_key" && onDoor) {
      if (isExitUnlocked(s, "control_room", "east")) {
        messages.push("The airlock door is already unlocked.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = unlockExit(ns, "control_room", "east");
      messages.push(
        "You insert the master key.  CLUNK.",
        "The airlock door swings free.  You can go EAST.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // ── Airlock ───────────────────────────────────────────────────────────────
  if (roomId === "airlock") {
    const onScanner =
      subject === "scanner" || subject === "sample_scanner" || subject === "biological_scanner" || subject === "bio_scanner" || subject === "door" || subject === "outer_door" || subject === "north";

    if (instrId === "specimen" && onScanner) {
      if (isExitUnlocked(s, "airlock", "north")) {
        messages.push("The scanner already authorized your exit.");
        return { newState: s, messages, costStep: false, valid: false };
      }
      let ns = deductStep(s);
      ns = addFlag(ns, "escape_unlocked");
      ns = unlockExit(ns, "airlock", "north");
      messages.push(
        "You place the specimen jar in the scanner slot.",
        "Blue light pulses as it analyzes the contents...",
        '"SAMPLE LOGGED.  BIOLOGICAL EXPORT AUTHORIZED."',
        '"AIRLOCK RELEASE GRANTED."',
        "The outer door disengages.  Freedom is one step NORTH.",
      );
      return { newState: ns, messages, costStep: true, valid: true };
    }
  }

  // Generic wrong-use response — still costs a step (attempted action)
  let ns = deductStep(s);
  messages.push(`Using the ${instrName} on the ${subject.replace(/_/g, " ")} does nothing here.`);
  return { newState: ns, messages, costStep: true, valid: false };
}

function handleEnterCode(
  s: GameState,
  code: string | undefined,
  messages: string[],
): EngineResult {
  if (s.currentRoomId !== "corridor") {
    messages.push("There is nothing to enter a code into here.");
    return { newState: s, messages, costStep: false, valid: false };
  }

  if (hasFlag(s, "lab_unlocked")) {
    messages.push('The terminal reads: "ACCESS GRANTED." The lab is already open.');
    return { newState: s, messages, costStep: false, valid: false };
  }

  // Auto-read code from note if no code specified
  let codeToEnter = code;
  if (!codeToEnter) {
    if (hasItem(s, "note")) {
      codeToEnter = "7743";
      messages.push("(Reading the code from your note...)");
    } else {
      messages.push("Enter what code? You haven't found the override code yet.");
      return { newState: s, messages, costStep: false, valid: false };
    }
  }

  let ns = deductStep(s);

  if (codeToEnter === "7743") {
    ns = addFlag(ns, "lab_unlocked");
    ns = unlockExit(ns, "corridor", "east");
    messages.push(
      `You enter ${codeToEnter} on the keypad.`,
      '"OVERRIDE ACCEPTED.  LAB ACCESS GRANTED."',
      "The east door unlocks.  You can go EAST.",
    );
    return { newState: ns, messages, costStep: true, valid: true };
  }

  messages.push(
    `You enter ${codeToEnter}.`,
    '"INVALID CODE."  The terminal beeps red.  Nothing happens.',
  );
  return { newState: ns, messages, costStep: true, valid: false };
}
