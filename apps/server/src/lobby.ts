import { buildDeck, rulesFor, type DealerLevel, type GameRules, type TableMode } from "@sportsjack/engine";
import { loadNbaGame, loadNbaRoster, loadNflverseGame, loadNflversePlayers, loadProjections, type GameInfo, type RecordedGame } from "@sportsjack/feed";
import type { ServerConfig } from "./config.ts";
import { GameRunner } from "./runner.ts";
import { Store } from "./store.ts";
import { ANTES, LOCKOUTS, Table, type TableSpec } from "./table.ts";

const LABELS: Record<string, string> = {
  "2025_22_SEA_NE": "Super Bowl LX",
  "2025_21_LA_SEA": "NFC Championship",
  "2025_16_LA_SEA": "Week 16 · went to overtime",
  "2025_04_GB_DAL": "Week 4 · 40–40 overtime tie",
  "2026_07_NE_CHI": "2026 Week 7 · Thursday night",
  "401859967": "2026 NBA Finals",
  "401873197": "2026 Playoffs · double overtime",
  "401909294": "2026-27 season · Friday night",
};

/** NBA games use ESPN's numeric ids; NFL games use nflverse ids like 2025_22_SEA_NE. */
const isNba = (gameId: string) => /^\d+$/.test(gameId);

export interface OpenTable { gameId: string; mode: TableMode; ante: number; lockout: number; level: DealerLevel }

/** Every replayed game, its runner and its tables. */
export class Lobby {
  readonly store: Store;
  readonly runners = new Map<string, GameRunner>();
  readonly games = new Map<string, GameInfo & { label: string }>();
  readonly tables = new Map<string, Table>();
  readonly #decks = new Map<string, ReturnType<typeof buildDeck>>();
  readonly #onChange: (table: Table | null) => void;
  readonly #recorded = new Map<string, RecordedGame>();
  readonly #rules = new Map<string, GameRules>();
  readonly #practices = new Map<string, GameRunner>();
  readonly #config: ServerConfig;
  #nextId = 1;

  constructor(config: ServerConfig, onChange: (table: Table | null) => void) {
    this.store = new Store(config.db);
    this.#onChange = onChange;
    this.#config = config;
    for (const gameId of config.games) {
      const dir = `${config.fixtures}${isNba(gameId) ? "nba" : "nflverse"}/`;
      const recorded = isNba(gameId) ? loadNbaGame(`${dir}games/${gameId}.csv`) : loadNflverseGame(`${dir}games/${gameId}.csv`);
      const rules = rulesFor(recorded.game.sport);
      const roster = isNba(gameId) ? loadNbaRoster(`${dir}rosters/${gameId}.csv`) : loadNflversePlayers(`${dir}rosters/${gameId}.csv`);
      const deck = buildDeck(roster, loadProjections(`${dir}projections/${gameId}.csv`), rules);
      this.#rules.set(gameId, rules);
      const runner = new GameRunner(recorded, { speed: config.speed, fromQuarter: config.fromQuarter, breakSeconds: config.breakSeconds, loop: config.loop });
      runner.on("quarter_start", () => onChange(null));
      runner.on("quarter_end", () => onChange(null));
      this.runners.set(gameId, runner);
      this.games.set(gameId, { ...recorded.game, label: LABELS[gameId] ?? `${recorded.game.away} at ${recorded.game.home}` });
      this.#decks.set(gameId, deck);
      this.#recorded.set(gameId, recorded);
      this.open({ gameId, mode: "dealer", ante: 25, lockout: 120, level: "easy" }, null);
      this.open({ gameId, mode: "dealer", ante: 100, lockout: 60, level: "sharp" }, null);
      this.open({ gameId, mode: "players", ante: 25, lockout: 120, level: "easy" }, null);
    }
  }

  /** Open a table. The lockout is the table's own setting, fixed for its life (MISSION.md Q11). */
  open(spec: OpenTable, openedBy: string | null): Table {
    const runner = this.runners.get(spec.gameId);
    if (!runner) throw new Error("unknown_game");
    if (!ANTES.includes(spec.ante)) throw new Error("bad_ante");
    if (!LOCKOUTS.includes(spec.lockout)) throw new Error("bad_lockout");
    if (spec.mode !== "dealer" && spec.mode !== "players") throw new Error("bad_mode");
    if (spec.level !== "easy" && spec.level !== "sharp") throw new Error("bad_level");
    const full: TableSpec = { ...spec, id: `t${this.#nextId++}`, openedBy };
    const table = new Table(full, runner, this.store, this.#decks.get(spec.gameId)!, this.#rules.get(spec.gameId)!, () => this.#onChange(table));
    this.tables.set(full.id, table);
    return table;
  }

  /**
   * A free practice hand for a first-time player (PRD §8.1): a private replay of a
   * dramatic quarter that deals at once, so nobody joins a quarter already under way.
   */
  practice(accountId: string): Table {
    const gameId = this.#recorded.has("2025_22_SEA_NE") ? "2025_22_SEA_NE" : [...this.#recorded.keys()][0]!;
    const runner = new GameRunner(this.#recorded.get(gameId)!, { speed: this.#config.speed, fromQuarter: 4, breakSeconds: 1, loop: false });
    const spec: TableSpec = { id: `p${this.#nextId++}`, gameId, mode: "dealer", ante: 0, lockout: 30, level: "easy", openedBy: accountId, practice: true };
    const table = new Table(spec, runner, this.store, this.#decks.get(gameId)!, this.#rules.get(gameId)!, () => this.#onChange(table));
    this.tables.set(spec.id, table);
    this.#practices.set(spec.id, runner);
    table.sit(accountId);
    return table;
  }

  /** Remove a practice table and its private replay. */
  dispose(tableId: string): void {
    const runner = this.#practices.get(tableId);
    if (!runner) return;
    runner.removeAllListeners();
    this.#practices.delete(tableId);
    this.tables.delete(tableId);
  }

  /** Step every game by `dt` real seconds. */
  advance(dt: number): void {
    for (const runner of this.runners.values()) runner.step(dt);
    for (const runner of this.#practices.values()) runner.step(dt);
  }

  summary() {
    return {
      games: [...this.games.values()].map((g) => ({ ...g, status: this.runners.get(g.gameId)!.status(), periods: this.runners.get(g.gameId)!.periods, rules: this.#rules.get(g.gameId)! })),
      tables: [...this.tables.values()].filter((t) => !t.spec.practice).map((t) => ({ ...t.spec, seated: t.seated.size, inHand: t.humans.length })),
    };
  }
}

export type LobbySummary = ReturnType<Lobby["summary"]>;
