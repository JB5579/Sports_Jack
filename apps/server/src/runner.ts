import { EventEmitter } from "node:events";
import { periodStart, type FeedEvent, type GameInfo, type RecordedGame } from "@sportsjack/feed";

export interface Period { q: number; start: number; end: number }
export type Phase = "break" | "quarter" | "final";

export interface RunnerStatus {
  gameId: string;
  sport: GameInfo["sport"];
  home: string;
  away: string;
  phase: Phase;
  qtr: number;
  clock: number;
  score: { home: number; away: number };
  paused: boolean;
  /** The quarter players can join next: the one about to start, or the next after this one. */
  nextQtr: number | null;
  breakLeft: number;
}

/** Each period's real clock: where it starts (by sport and overtime rules) and where it ended. */
export function periodsOf(recorded: RecordedGame): Period[] {
  const { game, events } = recorded;
  return events.filter((e) => e.kind === "quarter_end").map((e) => ({
    q: e.clock.qtr,
    start: periodStart(game, e.clock.qtr),
    end: e.clock.quarterSecondsRemaining,
  }));
}

/**
 * Plays one recorded game on the server's clock: a break, then each quarter's plays at
 * `speed` game seconds per real second, a break between quarters, and overtime when the
 * real game had it. Emits quarter_start, event, tick and quarter_end.
 */
export class GameRunner extends EventEmitter {
  readonly game: GameInfo;
  readonly periods: Period[];
  readonly #events: FeedEvent[];
  readonly #options: { speed: number; fromQuarter: number; breakSeconds: number; loop: boolean; firstBreakSeconds?: number };
  phase: Phase = "break";
  qtr: number;
  clock = 900;
  paused = false;
  #breakLeft: number;
  #idx = 0;
  #score = { home: 0, away: 0 };

  constructor(recorded: RecordedGame, options: { speed: number; fromQuarter: number; breakSeconds: number; loop: boolean; firstBreakSeconds?: number }) {
    super();
    this.game = recorded.game;
    this.#events = recorded.events;
    this.periods = periodsOf(recorded);
    this.#options = options;
    this.qtr = Math.min(options.fromQuarter, this.periods.at(-1)!.q) - 1;
    this.#breakLeft = options.firstBreakSeconds ?? options.breakSeconds;
    this.#scoreBefore(this.qtr + 1);
  }

  status(): RunnerStatus {
    const upcoming = this.qtr + 1;
    return {
      gameId: this.game.gameId, sport: this.game.sport, home: this.game.home, away: this.game.away, phase: this.phase, qtr: this.qtr, clock: this.clock, score: this.#score,
      paused: this.paused, breakLeft: Math.max(0, this.#breakLeft),
      nextQtr: this.periods.some((p) => p.q === upcoming) ? upcoming : null,
    };
  }

  /** Advance by `dt` real seconds. */
  step(dt: number): void {
    if (this.paused) return;
    if (this.phase === "break") {
      this.#breakLeft -= dt;
      if (this.#breakLeft <= 0) this.#begin(this.qtr + 1);
      return;
    }
    if (this.phase === "final") {
      this.#breakLeft -= dt;
      if (this.#options.loop && this.#breakLeft <= 0) this.#restart();
      return;
    }
    const period = this.periods.find((p) => p.q === this.qtr)!;
    this.clock = Math.max(period.end, this.clock - dt * this.#options.speed);
    this.emit("tick", this.clock);
    while (this.phase === "quarter" && this.#idx < this.#events.length) {
      const e = this.#events[this.#idx]!;
      // A stray event from an earlier period can't stall the quarter (MISSION.md invariant 2: hands settle).
      if (e.clock.qtr < this.qtr) { this.#idx++; continue; }
      if (e.clock.qtr !== this.qtr || e.clock.quarterSecondsRemaining < this.clock) break;
      this.#idx++;
      this.#score = e.score;
      this.emit("event", e);
      if (e.kind !== "play") this.#end();
    }
  }

  #begin(q: number): void {
    const period = this.periods.find((p) => p.q === q);
    if (!period) { this.phase = "final"; return; }
    this.qtr = q;
    this.clock = period.start;
    this.#idx = this.#events.findIndex((e) => e.clock.qtr === q);
    this.phase = "quarter";
    this.emit("quarter_start", q);
  }

  #end(): void {
    this.emit("quarter_end", this.qtr);
    const next = this.periods.some((p) => p.q === this.qtr + 1);
    this.phase = next ? "break" : "final";
    this.#breakLeft = next ? this.#options.breakSeconds : this.#options.breakSeconds * 2;
  }

  #restart(): void {
    this.qtr = this.#options.fromQuarter - 1;
    this.#scoreBefore(this.#options.fromQuarter);
    this.phase = "break";
    this.#breakLeft = this.#options.breakSeconds;
    this.emit("restart");
  }

  #scoreBefore(q: number): void {
    const prior = this.#events.filter((e) => e.clock.qtr < q).at(-1);
    this.#score = prior ? prior.score : { home: 0, away: 0 };
  }
}
