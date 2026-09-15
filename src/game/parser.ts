export interface ParsedAction {
  action: string;
  subject?: string;
  instrument?: string; // for USE X ON Y
  raw: string;
  display: string;
}

// Verb groups
const TAKE_WORDS = ["take", "grab", "pick up", "get", "collect", "retrieve", "acquire", "pocket", "pick"];
const USE_WORDS = ["use", "apply", "insert", "place", "put", "swipe", "slot", "attach", "plug"];
const OPEN_WORDS = ["open", "unlock", "unseal", "pry", "force open"];
const INSPECT_WORDS = ["inspect", "examine", "look at", "check", "read", "study", "x", "investigate", "search"];
const MOVE_WORDS = ["go", "move", "walk", "head", "run", "travel", "proceed", "exit", "enter"];
const DROP_WORDS = ["drop", "discard", "throw away", "leave", "toss"];

const DIR_MAP: Record<string, string> = {
  n: "north", north: "north",
  s: "south", south: "south",
  e: "east",  east: "east",
  w: "west",  west: "west",
};

// Canonical item IDs resolved from natural language
const ITEM_ALIASES: Record<string, string> = {
  flashlight: "flashlight",
  "flash light": "flashlight",
  light: "flashlight",
  torch: "flashlight",
  keycard: "keycard",
  "key card": "keycard",
  card: "keycard",
  key: "keycard",
  note: "note",
  paper: "note",
  message: "note",
  memo: "note",
  fuse: "fuse",
  "access badge": "access_badge",
  access_badge: "access_badge",
  badge: "access_badge",
  "id badge": "access_badge",
  "lab badge": "access_badge",
  "id card": "access_badge",
  "chens badge": "access_badge",
  "dr chens badge": "access_badge",
  specimen: "specimen",
  "specimen jar": "specimen",
  jar: "specimen",
  vial: "specimen",
  sample: "specimen",
  "blue jar": "specimen",
  "master key": "master_key",
  master_key: "master_key",
  "brass key": "master_key",
  "airlock key": "master_key",
  "heavy key": "master_key",
};

// Object IDs resolved from natural language
const OBJECT_ALIASES: Record<string, string> = {
  "card reader": "card_reader",
  card_reader: "card_reader",
  reader: "card_reader",
  slot: "card_reader",
  terminal: "terminal",
  computer: "terminal",
  screen: "terminal",
  keypad: "terminal",
  panel: "panel",
  "breaker panel": "panel",
  breaker: "panel",
  "fuse slot": "panel",
  "fuse box": "panel",
  "breaker box": "panel",
  generator: "generator",
  generators: "generator",
  engine: "generator",
  cabinet: "cabinet",
  "specimen cabinet": "cabinet",
  safe: "cabinet",
  locker: "cabinet",
  drawer: "drawer",
  "workbench drawer": "drawer",
  console: "console",
  "control console": "console",
  scanner: "scanner",
  "sample scanner": "scanner",
  "bio scanner": "scanner",
  "biological scanner": "scanner",
  door: "door",
  "north door": "door",
  "east door": "door",
  "outer door": "outer_door",
  exit: "door",
  shelf: "shelf",
  shelves: "shelf",
  crates: "crates",
  monitors: "monitors",
  monitor: "monitors",
  stain: "stain",
};

// Meta/cheat patterns — these are rejected immediately
const META_PATTERNS = [
  /\b(set|change|modify|alter)\b.*(step|move|health|score|level|inventory|rule)/i,
  /\bgive me\b/i,
  /\bignore\b.*(rule|game|limit|constraint)/i,
  /\bcheat\b/i,
  /\bhack\b/i,
  /\badmin\b/i,
  /\bdebug mode\b/i,
  /\bunlock all\b/i,
  /\bteleport\b/i,
  /\bskip to\b/i,
  /\bbypass\b/i,
  /\bwin\b.*\bgame\b/i,
  /\bwarp\b/i,
  /\bno rules\b/i,
  /\bsteps to\s+\d+/i,
  /\binventory.*add\b/i,
];

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ");
}

function stripArticles(s: string): string {
  return s
    .replace(/\b(the|a|an|my|some|that|this|these|those)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveItem(s: string): string {
  const clean = stripArticles(norm(s));
  if (ITEM_ALIASES[clean]) return ITEM_ALIASES[clean];
  for (const [alias, id] of Object.entries(ITEM_ALIASES)) {
    if (clean.includes(alias) || alias.includes(clean)) return id;
  }
  return clean.replace(/\s+/g, "_");
}

function resolveObject(s: string): string {
  const clean = stripArticles(norm(s));
  if (OBJECT_ALIASES[clean]) return OBJECT_ALIASES[clean];
  for (const [alias, id] of Object.entries(OBJECT_ALIASES)) {
    if (clean.includes(alias) || alias.includes(clean)) return id;
  }
  return clean.replace(/\s+/g, "_");
}

export function parseCommand(raw: string): ParsedAction {
  const input = norm(raw);

  // Security: reject meta-commands
  for (const pattern of META_PATTERNS) {
    if (pattern.test(raw)) {
      return { action: "UNKNOWN", raw, display: "REJECTED: invalid command" };
    }
  }

  // LOOK
  if (
    input === "look" ||
    input === "l" ||
    input === "look around" ||
    input === "where am i" ||
    input === "survey" ||
    input === "ls"
  ) {
    return { action: "LOOK", raw, display: "LOOK" };
  }

  // INVENTORY
  if (input === "inventory" || input === "i" || input === "backpack" || input === "items" || input === "bag") {
    return { action: "INVENTORY", raw, display: "INVENTORY" };
  }

  // HELP
  if (input === "help" || input === "?" || input === "commands") {
    return { action: "HELP", raw, display: "HELP" };
  }

  // Bare direction shortcut
  if (DIR_MAP[input]) {
    const dir = DIR_MAP[input];
    return { action: "MOVE", subject: dir, raw, display: `MOVE: ${dir.toUpperCase()}` };
  }

  // Code entry: "enter 7743", "type 7743", "enter code 7743", bare number
  const codeNumMatch = input.match(/(?:enter|type|input|key in|punch in|use code)\s+(?:code\s+)?(\d+)/);
  if (codeNumMatch) {
    const code = codeNumMatch[1];
    return { action: "ENTER_CODE", subject: code, raw, display: `ENTER: CODE ${code}` };
  }

  // "enter the code" or "enter code" without number → auto-read from note
  if (/^(?:enter|type|input)\s+(?:the\s+)?code\s*$/.test(input)) {
    return { action: "ENTER_CODE", subject: undefined, raw, display: "ENTER: CODE (auto)" };
  }

  // Bare number
  if (/^\d+$/.test(input)) {
    return { action: "ENTER_CODE", subject: input, raw, display: `ENTER: CODE ${input}` };
  }

  // MOVE: "go north", "head west", "walk east"
  for (const verb of MOVE_WORDS) {
    const re = new RegExp(`^${verb.replace(" ", "\\s+")}\\s+(.+)$`);
    const m = input.match(re);
    if (m) {
      const rest = m[1].trim().replace(/^(to the|to|the)\s+/, "");
      const dir = DIR_MAP[rest];
      if (dir) return { action: "MOVE", subject: dir, raw, display: `MOVE: ${dir.toUpperCase()}` };
    }
  }

  // USE X ON Y — must come before TAKE/OPEN to catch "use note on terminal"
  for (const verb of USE_WORDS) {
    const re = new RegExp(`^${verb.replace(" ", "\\s+")}\\s+(.+)$`);
    const m = input.match(re);
    if (m) {
      const rest = m[1];
      const onMatch = rest.match(/^(.+?)\s+(?:on|with|in|into|at|against|to|for)\s+(.+)$/);
      if (onMatch) {
        const instrument = resolveItem(onMatch[1]);
        const subjRaw = onMatch[2];
        // Prefer object alias, fall back to item alias
        const subject = resolveObject(subjRaw) !== subjRaw.replace(/\s+/g, "_")
          ? resolveObject(subjRaw)
          : resolveItem(subjRaw) !== subjRaw.replace(/\s+/g, "_")
          ? resolveItem(subjRaw)
          : resolveObject(subjRaw);
        return {
          action: "USE",
          subject,
          instrument,
          raw,
          display: `USE: ${instrument.toUpperCase()} ON ${subject.toUpperCase()}`,
        };
      }
      // USE X alone — try to resolve as object
      const subj = resolveObject(rest) || resolveItem(rest);
      return {
        action: "USE",
        subject: subj,
        raw,
        display: `USE: ${subj.toUpperCase()}`,
      };
    }
  }

  // TAKE X
  for (const verb of TAKE_WORDS) {
    if (input === verb) continue;
    const re = new RegExp(`^${verb.replace(" ", "\\s+")}\\s+(.+)$`);
    const m = input.match(re);
    if (m) {
      const item = resolveItem(m[1]);
      return { action: "TAKE", subject: item, raw, display: `TAKE: ${item.toUpperCase()}` };
    }
  }

  // OPEN X
  for (const verb of OPEN_WORDS) {
    const re = new RegExp(`^${verb.replace(" ", "\\s+")}\\s+(.+)$`);
    const m = input.match(re);
    if (m) {
      const subj = resolveObject(m[1]);
      return { action: "OPEN", subject: subj, raw, display: `OPEN: ${subj.toUpperCase()}` };
    }
  }

  // INSPECT / EXAMINE X
  for (const verb of INSPECT_WORDS) {
    if (input === verb) return { action: "LOOK", raw, display: "LOOK" };
    const re = new RegExp(`^${verb.replace(" ", "\\s+")}\\s+(.+)$`);
    const m = input.match(re);
    if (m) {
      const subj = resolveObject(m[1]) || resolveItem(m[1]);
      return { action: "INSPECT", subject: subj, raw, display: `INSPECT: ${subj.toUpperCase()}` };
    }
  }

  // DROP X
  for (const verb of DROP_WORDS) {
    const re = new RegExp(`^${verb.replace(" ", "\\s+")}\\s+(.+)$`);
    const m = input.match(re);
    if (m) {
      const item = resolveItem(m[1]);
      return { action: "DROP", subject: item, raw, display: `DROP: ${item.toUpperCase()}` };
    }
  }

  return { action: "UNKNOWN", raw, display: `UNKNOWN: "${raw}"` };
}
