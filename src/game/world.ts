export interface Item {
  id: string;
  name: string;
  description: string;
}

export interface Exit {
  direction: string;
  roomId: string;
  locked: boolean;
  lockedBy?: string;
  lockedMessage?: string;
}

export interface WorldObject {
  id: string;
  name: string;
  description: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  items: string[];
  exits: Exit[];
  objects: WorldObject[];
}

export const ITEMS: Record<string, Item> = {
  flashlight: {
    id: "flashlight",
    name: "FLASHLIGHT",
    description: "A heavy metal flashlight. Beam still works.",
  },
  keycard: {
    id: "keycard",
    name: "KEYCARD",
    description: 'Magnetic keycard. Red stripe. "SECTOR-1" stamped on the back.',
  },
  note: {
    id: "note",
    name: "NOTE",
    description:
      '"Emergency override code: 7743. Do NOT lose this." — scrawled in red marker.',
  },
  fuse: {
    id: "fuse",
    name: "FUSE",
    description:
      "A glass cylindrical fuse, 15A. One end is scorched but it should still work.",
  },
  access_badge: {
    id: "access_badge",
    name: "ACCESS BADGE",
    description: 'Lab access badge. "Dr. M. Chen — Level 3 Clearance." Photo still attached.',
  },
  specimen: {
    id: "specimen",
    name: "SPECIMEN JAR",
    description: "A sealed specimen jar. Blue bioluminescent fluid pulses faintly inside.",
  },
  master_key: {
    id: "master_key",
    name: "MASTER KEY",
    description: 'A heavy brass key engraved: "AIRLOCK — EMERGENCY USE ONLY."',
  },
};

export const ROOMS: Record<string, Room> = {
  storage_bay: {
    id: "storage_bay",
    name: "STORAGE BAY",
    description:
      "Red emergency lights cast long shadows across stacked crates and metal shelves. The air is stale and cold. A keycard reader glows red beside the sealed door to the NORTH.\n\nA flashlight and a keycard sit on the top shelf. A note is pinned to a crate.",
    items: ["flashlight", "keycard", "note"],
    exits: [
      {
        direction: "north",
        roomId: "corridor",
        locked: true,
        lockedBy: "keycard",
        lockedMessage: "The card reader blinks red. You need a keycard to open this door.",
      },
    ],
    objects: [
      {
        id: "shelf",
        name: "SHELF",
        description:
          "Metal shelving bolted to the wall. A flashlight, a keycard, and a crumpled note rest here.",
      },
      {
        id: "card_reader",
        name: "CARD READER",
        description: "A magnetic card reader beside the north door. Indicator blinks red.",
      },
      {
        id: "crates",
        name: "CRATES",
        description:
          'Heavy shipping crates. Stenciled: "STATION SIGMA — RESTRICTED CARGO." Welded shut.',
      },
    ],
  },

  corridor: {
    id: "corridor",
    name: "MAIN CORRIDOR",
    description:
      "A low maintenance corridor runs WEST toward the generator room. EAST, a sealed door leads to the lab — a wall terminal blinks beside it, awaiting a code. SOUTH is the storage bay.\n\nA glass fuse lies on the floor near the east wall.",
    items: ["fuse"],
    exits: [
      { direction: "south", roomId: "storage_bay", locked: false },
      { direction: "west", roomId: "generator_room", locked: false },
      {
        direction: "east",
        roomId: "lab",
        locked: true,
        lockedBy: "code",
        lockedMessage:
          "The east door is sealed. The terminal beside it requires an override code.",
      },
    ],
    objects: [
      {
        id: "terminal",
        name: "TERMINAL",
        description:
          'An old CRT terminal. Screen: "LAB ACCESS LOCKED — ENTER OVERRIDE CODE: [ _ _ _ _ ]". A numeric keypad glows beneath it.',
      },
    ],
  },

  generator_room: {
    id: "generator_room",
    name: "GENERATOR ROOM",
    description:
      "Massive diesel generators stand cold and silent. Burned rubber smell lingers. The main breaker panel hangs open on the far wall — the 15A fuse socket is empty. Without power, half the station is offline. EAST returns to the corridor.",
    items: [],
    exits: [{ direction: "east", roomId: "corridor", locked: false }],
    objects: [
      {
        id: "generator",
        name: "GENERATOR",
        description:
          "The main generator. Dead. The breaker panel beside it has one empty fuse slot labelled \"MAIN — 15A\".",
      },
      {
        id: "panel",
        name: "BREAKER PANEL",
        description:
          "The main breaker panel. Open. The \"MAIN POWER — 15A\" fuse slot is completely empty. This is why everything is dark.",
      },
    ],
  },

  lab: {
    id: "lab",
    name: "RESEARCH LAB",
    description:
      "A research lab turned disaster zone. Overturned equipment and shattered beakers cover the floor. A sealed specimen cabinet hums in the corner — amber light, badge scanner on the front. A workbench drawer sits closed. NORTH leads to the control room (badge scanner required). WEST returns to the corridor.",
    items: [],
    exits: [
      { direction: "west", roomId: "corridor", locked: false },
      {
        direction: "north",
        roomId: "control_room",
        locked: true,
        lockedBy: "badge",
        lockedMessage:
          "The badge scanner by the north door flashes red. Level 3 clearance required.",
      },
    ],
    objects: [
      {
        id: "drawer",
        name: "DRAWER",
        description:
          "A metal workbench drawer. Closed. Something might be inside.",
      },
      {
        id: "cabinet",
        name: "SPECIMEN CABINET",
        description:
          "A reinforced specimen cabinet with a badge scanner on the front. Amber indicator. Something is sealed inside.",
      },
    ],
  },

  control_room: {
    id: "control_room",
    name: "CONTROL ROOM",
    description:
      "Banks of dead monitors line the curved walls. A central console dominates the room — panels locked, displays dark. EAST leads to the airlock (large keyhole in the door). SOUTH returns to the lab.\n\nNote: The console reads \"REQUIRES MAIN POWER\" on a label.",
    items: [],
    exits: [
      { direction: "south", roomId: "lab", locked: false },
      {
        direction: "east",
        roomId: "airlock",
        locked: true,
        lockedBy: "masterkey",
        lockedMessage:
          "The airlock door is sealed with a heavy keyhole. You need the master key.",
      },
    ],
    objects: [
      {
        id: "console",
        name: "CONSOLE",
        description:
          'The central control console. Panels locked and dark. Label reads: "EMERGENCY SYSTEMS — REQUIRES MAIN POWER." A keyhole on the front panel suggests something is stored inside.',
      },
      {
        id: "monitors",
        name: "MONITORS",
        description:
          'Banks of dark monitors. One still flickers: "CRITICAL FAILURE — RESTORE GENERATOR POWER."',
      },
    ],
  },

  airlock: {
    id: "airlock",
    name: "AIRLOCK",
    description:
      "The station emergency airlock. Cold seeps through the seams of the outer door to the NORTH. A biological sample scanner glows red beside it — station protocol requires logging samples before departure. WEST returns to the control room.",
    items: [],
    exits: [
      { direction: "west", roomId: "control_room", locked: false },
      {
        direction: "north",
        roomId: "escape",
        locked: true,
        lockedBy: "scanner",
        lockedMessage:
          "The outer door stays sealed. The biological scanner must authorize your exit first.",
      },
    ],
    objects: [
      {
        id: "scanner",
        name: "SCANNER",
        description:
          '"STATION PROTOCOL 7: All biological samples must be logged before departure. Insert specimen jar to authorize airlock release." Red indicator.',
      },
      {
        id: "outer_door",
        name: "OUTER DOOR",
        description:
          "A massive reinforced door. Through a small porthole: stars. Darkness. Freedom.",
      },
    ],
  },

  escape: {
    id: "escape",
    name: "— FREEDOM —",
    description: "You escaped.",
    items: [],
    exits: [],
    objects: [],
  },
};
