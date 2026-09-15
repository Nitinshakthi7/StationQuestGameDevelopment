import { useState, useRef, useEffect, useCallback } from "react";
import { createInitialState, processAction, describeRoom } from "./game/engine";
import type { GameState } from "./game/engine";
import { parseCommand } from "./game/parser";
import { ITEMS, ROOMS } from "./game/world";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  lines: string[];
  kind: "intro" | "cmd" | "result" | "error" | "win";
}

let entryId = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyLine(line: string): string {
  if (line.startsWith("▸")) return "line-heading";
  if (line.startsWith("✦")) return "line-win";
  if (line.startsWith("Items here:")) return "line-items";
  if (line.startsWith("Exits:")) return "line-exits";
  if (line.startsWith("TAKE:") || line.startsWith("USE:") || line.startsWith("MOVE:") ||
      line.startsWith("OPEN:") || line.startsWith("INSPECT:") || line.startsWith("LOOK") ||
      line.startsWith("ENTER:") || line.startsWith("DROP:") || line.startsWith("INVENTORY") ||
      line.startsWith("HELP") || line.startsWith("UNKNOWN") || line.startsWith("REJECTED")) {
    return "line-interp";
  }
  if (line === "") return "line-blank";
  return "line-body";
}

const INTRO_LINES = [
  "╔══════════════════════════════════════════════════════════════╗",
  "║           S  T  A  T  I  O  N    Q  U  E  S  T             ║",
  "╠══════════════════════════════════════════════════════════════╣",
  "║  You are trapped aboard Station Sigma.                      ║",
  "║  Find a way out before your steps run out.                  ║",
  "║  Every action counts. 30 steps. No second chances.          ║",
  "╚══════════════════════════════════════════════════════════════╝",
  "",
  "Type HELP for commands.  Type LOOK to see your surroundings.",
  "",
];

// ─── Components ───────────────────────────────────────────────────────────────

function StepBar({ steps, max }: { steps: number; max: number }) {
  const pct = Math.max(0, (steps / max) * 100);
  const critical = steps <= 8;
  const warning = steps <= 16;
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs tabular-nums tracking-widest ${critical ? "text-red-400 animate-pulse" : "text-green-400"}`}>
        STEPS {String(steps).padStart(2, "0")}/{max}
      </span>
      <div className="w-28 h-1 bg-green-950 rounded-none overflow-hidden border border-green-900">
        <div
          className={`h-full transition-all duration-300 ${critical ? "bg-red-500" : warning ? "bg-amber-400" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BackpackPanel({ gameState }: { gameState: GameState }) {
  const items = gameState.inventory.map((id) => ITEMS[id]).filter(Boolean);
  const room = ROOMS[gameState.currentRoomId];

  return (
    <aside className="w-52 shrink-0 flex flex-col border-l border-green-900 bg-[#060a06]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-green-900">
        <div className="text-[10px] tracking-[0.25em] text-green-700 uppercase">Backpack</div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-hide">
        {items.length === 0 ? (
          <div className="text-green-900 text-xs italic mt-1">empty</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="border border-green-900 p-2 hover:border-green-700 transition-colors">
              <div className="text-green-400 text-[11px] font-bold tracking-wide">{item.name}</div>
              <div className="text-green-800 text-[10px] leading-snug mt-0.5">{item.description}</div>
            </div>
          ))
        )}
      </div>

      {/* Location footer */}
      <div className="px-3 py-2 border-t border-green-900">
        <div className="text-[10px] tracking-[0.2em] text-green-900 uppercase mb-0.5">Location</div>
        <div className="text-green-600 text-[11px] tracking-wide">{room?.name}</div>
      </div>
    </aside>
  );
}

function TextDisplay({ entries, endRef }: { entries: LogEntry[]; endRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <main className="flex-1 min-w-0 overflow-y-auto px-5 py-4 space-y-0.5 scrollbar-hide text-[13px] leading-relaxed">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`mb-1 ${
            entry.kind === "intro"
              ? "text-green-500"
              : entry.kind === "win"
              ? "text-amber-400"
              : entry.kind === "error"
              ? "text-red-400"
              : "text-green-400"
          }`}
        >
          {entry.lines.map((line, i) => {
            const cls = classifyLine(line);
            return (
              <div
                key={i}
                className={
                  cls === "line-interp"
                    ? "text-green-900 text-xs pl-2 before:content-['['] before:mr-0.5 after:content-[']'] after:ml-0.5"
                    : cls === "line-heading"
                    ? "text-green-300 font-bold mt-3 mb-0.5"
                    : cls === "line-win"
                    ? "text-amber-400 font-bold text-center py-1"
                    : cls === "line-items"
                    ? "text-amber-600 text-xs"
                    : cls === "line-exits"
                    ? "text-green-600 text-xs"
                    : cls === "line-blank"
                    ? "h-2"
                    : ""
                }
              >
                {line || " "}
              </div>
            );
          })}
          {/* Separator after each entry */}
          <div className="border-b border-green-950 mt-1" />
        </div>
      ))}
      <div ref={endRef} />
    </main>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [blinking, setBlinking] = useState(true);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setBlinking((b) => !b), 530);
    return () => clearInterval(t);
  }, []);

  // Initialize
  useEffect(() => {
    const initState = createInitialState();
    const roomLines = describeRoom(initState);
    setLog([
      { id: entryId++, lines: INTRO_LINES, kind: "intro" },
      { id: entryId++, lines: roomLines, kind: "result" },
    ]);
    inputRef.current?.focus();
  }, []);

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const appendEntry = useCallback((lines: string[], kind: LogEntry["kind"]) => {
    setLog((prev) => [...prev, { id: entryId++, lines, kind }]);
  }, []);

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;

    setInput("");
    setHistIdx(-1);
    setCmdHistory((h) => [cmd, ...h].slice(0, 60));

    const parsed = parseCommand(cmd);
    const result = processAction(gameState, parsed);

    setGameState(result.newState);

    const kind: LogEntry["kind"] = result.newState.won
      ? "win"
      : !result.valid && result.messages.length > 0
      ? "error"
      : "result";

    appendEntry(result.messages, kind);
  }, [input, gameState, appendEntry]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.min(histIdx + 1, cmdHistory.length - 1);
        setHistIdx(next);
        setInput(cmdHistory[next] ?? "");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.max(histIdx - 1, -1);
        setHistIdx(next);
        setInput(next === -1 ? "" : (cmdHistory[next] ?? ""));
      }
    },
    [handleSubmit, histIdx, cmdHistory],
  );

  const gameOver = gameState.won || gameState.lost;

  return (
    <div
      className="min-h-screen bg-[#050805] flex flex-col select-none overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* CRT scanlines */}
      <div className="pointer-events-none fixed inset-0 z-50 scanlines" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-2 border-b border-green-900 bg-[#030603]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400 tracking-[0.4em] text-xs font-bold uppercase">
            Station Quest
          </span>
        </div>
        <div className="flex items-center gap-4">
          {gameState.won && (
            <span className="text-amber-400 text-xs tracking-widest font-bold animate-pulse">
              ✦ MISSION COMPLETE ✦
            </span>
          )}
          {gameState.lost && (
            <span className="text-red-500 text-xs tracking-widest font-bold">
              ⚠ POWER FAILURE — TRAPPED ⚠
            </span>
          )}
          <StepBar steps={gameState.steps} max={gameState.maxSteps} />
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TextDisplay entries={log} endRef={logEndRef} />
        <BackpackPanel gameState={gameState} />
      </div>

      {/* ── Command Input ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-green-900 bg-[#030603] px-5 py-3">
        {gameOver ? (
          <div className={`text-sm tracking-widest text-center ${gameState.won ? "text-amber-400" : "text-red-500"}`}>
            {gameState.won
              ? "✦  YOU ESCAPED STATION SIGMA  ✦"
              : "— SYSTEMS OFFLINE — GAME OVER —"}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-sm">▶</span>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setHistIdx(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="enter command..."
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent outline-none text-green-300 text-sm placeholder-green-950 caret-transparent"
              />
              {/* Blinking block cursor */}
              <span
                className="absolute top-0 text-sm text-green-400 pointer-events-none"
                style={{
                  left: `${input.length}ch`,
                  opacity: blinking ? 1 : 0,
                  transition: "opacity 0.05s",
                }}
              >
                █
              </span>
            </div>
          </div>
        )}
        {/* Hint bar */}
        {!gameOver && (
          <div className="flex gap-4 mt-1.5 text-[10px] text-green-950 tracking-wide">
            <span>LOOK</span>
            <span>GO [DIR]</span>
            <span>TAKE [ITEM]</span>
            <span>USE [ITEM] ON [OBJECT]</span>
            <span>OPEN [OBJECT]</span>
            <span>INSPECT [THING]</span>
            <span>HELP</span>
          </div>
        )}
      </div>
    </div>
  );
}
