/** Raw per-player stat changes caused by one play. Scoring lives in the engine. */
export interface StatDelta {
  passYds?: number;
  passTd?: number;
  int?: number;
  sacked?: number;
  rushYds?: number;
  rushTd?: number;
  rec?: number;
  recYds?: number;
  recTd?: number;
  fumLost?: number;
  twoPt?: number;
  /** Kickoff or punt returned for a touchdown. */
  retTd?: number;
}

export type StatKey = keyof StatDelta;

export interface PlayerDelta {
  playerId: string;
  name: string;
  team: string;
  stats: StatDelta;
}

export interface GameClock {
  qtr: number;
  /** Seconds left in the quarter, 0..900. */
  quarterSecondsRemaining: number;
  /** "MM:SS" as shown on the broadcast. */
  display: string;
}

interface BaseEvent {
  gameId: string;
  /** Monotonic within a game; stable across replays of the same source. */
  seq: number;
  clock: GameClock;
  score: { home: number; away: number };
  /** Real-world time of the event when the source knows it (ISO-8601). */
  wallClock?: string;
}

export interface PlayEvent extends BaseEvent {
  kind: "play";
  playId: string;
  possession: string;
  description: string;
  deltas: PlayerDelta[];
}

export interface QuarterEndEvent extends BaseEvent {
  kind: "quarter_end";
}

export interface GameEndEvent extends BaseEvent {
  kind: "game_end";
}

export type FeedEvent = PlayEvent | QuarterEndEvent | GameEndEvent;

export interface GameInfo {
  gameId: string;
  season: number;
  week: number;
  date: string;
  home: string;
  away: string;
}

export interface Player {
  playerId: string;
  name: string;
  position: string;
  team: string;
}

/**
 * Anything that can deliver a game's events in order: a replay of recorded plays
 * today, a live provider later. Consumers must not care which.
 */
export interface FeedSource {
  readonly game: GameInfo;
  events(): AsyncIterable<FeedEvent>;
}
