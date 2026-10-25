import type { FeedEvent, FeedSource, GameInfo } from "./types.ts";
import type { RecordedGame } from "./nflverse.ts";

export interface ReplayOptions {
  /**
   * How much faster than the real game clock to play. 1 = real game-clock time,
   * 60 = one game-clock minute per second. Infinity = no waiting (tests).
   */
  speed?: number;
  /** Start from the first event of this quarter. */
  fromQuarter?: number;
  /** Longest real wait between two events, in ms, so stoppages do not stall a demo. */
  maxGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function elapsed(event: FeedEvent): number {
  return (event.clock.qtr - 1) * 900 + (900 - event.clock.quarterSecondsRemaining);
}

/** Plays a recorded game back through the FeedSource interface, paced by its game clock. */
export class ReplaySource implements FeedSource {
  readonly game: GameInfo;
  readonly #events: FeedEvent[];
  readonly #options: ReplayOptions;

  constructor(recorded: RecordedGame, options: ReplayOptions = {}) {
    this.game = recorded.game;
    const from = options.fromQuarter ?? 1;
    this.#events = recorded.events.filter((e) => e.clock.qtr >= from);
    this.#options = options;
  }

  async *events(): AsyncIterable<FeedEvent> {
    const speed = this.#options.speed ?? Infinity;
    const sleep = this.#options.sleep ?? defaultSleep;
    const maxGap = this.#options.maxGapMs ?? 15_000;
    let previous: FeedEvent | undefined;
    for (const event of this.#events) {
      if (previous && Number.isFinite(speed)) {
        const gapMs = ((elapsed(event) - elapsed(previous)) * 1000) / speed;
        if (gapMs > 0) await sleep(Math.min(gapMs, maxGap));
      }
      previous = event;
      yield event;
    }
  }
}
