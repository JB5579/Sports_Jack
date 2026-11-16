import type { FeedEvent } from "@sportsjack/feed";
import type { Card } from "./deck.ts";
import { seededRandom } from "./random.ts";
import { ALPHA_RULES, roundValue, type GameRules } from "./rules.ts";
import { QuarterScorer } from "./scoring.ts";
import { settleDealer, settlePlayers, type Settlement } from "./settlement.ts";

export type TableMode = "dealer" | "players";

export interface HandOptions {
  gameId: string;
  /** 1–4, or 5 for the overtime bonus hand. */
  qtr: number;
  /** Seconds on the clock when the period starts: 900, or 600 for regular-season overtime. */
  periodStart: number;
  /** Hit, Burn and Freeze close with this many seconds left; 0 for no lockout. */
  lockout: number;
  ante: number;
  mode: TableMode;
  deck: Card[];
  /** Seat ids in deal order. At a dealer table, `dealerSeat` must be one of them. */
  seats: string[];
  dealerSeat?: string;
  seed: number;
  rules?: GameRules;
  /**
   * `own` (the default): one draw sequence for the table, so each seat gets different cards.
   * `shared`: every seat draws from its own copy of the same sequence, so everyone is dealt
   * the same two cards, and two seats that make the same moves get the same cards. Only
   * decisions separate the hands (prd/FOUNDATION.md §3).
   */
  deal?: "own" | "shared";
}

export type RefusalReason = "settled" | "frozen" | "locked" | "burn_used" | "not_in_hand" | "unknown_seat";

export class ActionRefused extends Error {
  readonly reason: RefusalReason;
  constructor(reason: RefusalReason) {
    super(`action refused: ${reason}`);
    this.reason = reason;
  }
}

interface SeatState {
  cards: string[];
  frozenAt: number | null;
  /** Burns left: one per hand, plus one for each injured player the seat holds. */
  burns: number;
  draw: () => number;
}

/** A player the play-by-play says was hurt (MVP edge-case rules, 2026-11-16). */
export interface Injury {
  seq: number;
  playerId: string;
  clock: number;
  /** His quarter points when he went down. His card keeps this value for the rest of the hand. */
  points: number;
}

const SUFFIXES = new Set(["Jr.", "Sr.", "II", "III", "IV", "V"]);

/** "Kenneth Walker III" → "K.Walker": the way play-by-play names a player. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter((p) => !SUFFIXES.has(p));
  if (parts.length < 2) return fullName.trim();
  return `${parts[0]![0]}.${parts.slice(1).join(" ")}`;
}

/** One card-value change, with the feed event behind it (MISSION.md invariant 2). */
export interface ValueChange {
  seq: number;
  playId: string;
  playerId: string;
  points: number;
  clock: number;
}

/** What an AI seat may see: its own hand, public projections, the clock. Never future plays. */
export interface SeatView {
  cards: { playerId: string; value: number; projection: number }[];
  total: number;
  frozen: boolean;
  burned: boolean;
  /** Burns still available: normally 0 or 1, more after an injury. */
  burnsLeft: number;
  canAct: boolean;
  /** Share of the period left before actions close, 0–1. */
  timeLeft: number;
  /** Seconds on the period's clock. */
  clock: number;
  /** The table's action lockout in seconds; 0 for none. */
  lockout: number;
  deckAverage: { face: number; projection: number };
  liveWeight: number;
}

/**
 * One quarter of one table: the deal, live values, Hit/Burn/Freeze, the lockout and
 * settlement. Pure: time and plays arrive only through `apply` and `advanceClock`.
 */
export class Hand {
  readonly options: HandOptions;
  readonly rules: GameRules;
  readonly log: ValueChange[] = [];
  readonly injuries: Injury[] = [];
  #clock: number;
  #over = false;
  #voided: string | null = null;
  readonly #scorer: QuarterScorer;
  readonly #cards: Map<string, Card>;
  readonly #seats = new Map<string, SeatState>();
  readonly #draw: () => number;

  constructor(options: HandOptions) {
    this.options = options;
    this.rules = options.rules ?? ALPHA_RULES;
    this.#scorer = new QuarterScorer(this.rules.scoring);
    this.#cards = new Map(options.deck.map((c) => [c.playerId, c]));
    this.#clock = options.periodStart;
    this.#draw = seededRandom(options.seed);
    if (options.mode === "dealer" && !options.seats.includes(options.dealerSeat ?? "")) {
      throw new Error("a dealer table needs its dealer seat among the seats");
    }
    for (const id of options.seats) {
      const draw = options.deal === "shared" ? seededRandom(options.seed) : this.#draw;
      const seat: SeatState = { cards: [], frozenAt: null, burns: 1, draw };
      this.#seats.set(id, seat);
      // One at a time: each draw has to see the cards already in the hand.
      seat.cards.push(this.#drawFor(seat));
      seat.cards.push(this.#drawFor(seat));
    }
  }

  get clock(): number { return this.#clock; }
  get over(): boolean { return this.#over; }
  /** Set when the game was suspended or cancelled: the hand ended without a result. */
  get voided(): string | null { return this.#voided; }

  /** End the hand without a result. Nothing settles; the table refunds every ante. */
  void(reason: string): void {
    if (this.#over) return;
    this.#over = true;
    this.#voided = reason;
  }
  get locked(): boolean { return this.options.lockout > 0 && this.#clock <= this.options.lockout; }

  /** Feed one event. Events for other games or earlier quarters are ignored. */
  apply(event: FeedEvent): void {
    const { qtr } = this.options;
    if (this.#over || event.gameId !== this.options.gameId || event.clock.qtr < qtr) return;
    if (event.clock.qtr > qtr) { this.#over = true; return; }
    this.advanceClock(event.clock.quarterSecondsRemaining);
    // A suspended or cancelled game is the table's to handle: it voids the hand.
    if (event.kind === "game_status") return;
    if (event.kind !== "play") { this.#over = true; return; }
    const before = new Map(event.deltas.map((d) => [d.playerId, this.#scorer.points(qtr, d.playerId)]));
    this.#scorer.apply(event);
    for (const d of event.deltas) {
      if (this.#injured(d.playerId)) continue; // his card's value was fixed when he went down
      const points = roundValue(this.#scorer.points(qtr, d.playerId) - (before.get(d.playerId) ?? 0));
      if (points !== 0) this.log.push({ seq: event.seq, playId: event.playId, playerId: d.playerId, points, clock: this.#clock });
    }
    for (const hurt of event.injured ?? []) this.#injure(event.seq, hurt.team, hurt.name);
  }

  /**
   * A player went down. His card keeps its value as of this play, every hand still able to
   * act that holds him gets one more Burn, and he is not drawn again this hand. A name
   * that matches no card, or more than one, changes nothing.
   */
  #injure(seq: number, team: string, name: string): void {
    const matches = [...this.#cards.values()].filter((c) => c.team === team && shortName(c.name) === name);
    if (matches.length !== 1) return;
    const playerId = matches[0]!.playerId;
    if (this.#injured(playerId)) return;
    this.injuries.push({ seq, playerId, clock: this.#clock, points: this.#scorer.points(this.options.qtr, playerId) });
    for (const seat of this.#seats.values()) {
      if (seat.cards.includes(playerId) && this.#refusal(seat) === null) seat.burns++;
    }
  }

  #injured(playerId: string): Injury | undefined {
    return this.injuries.find((i) => i.playerId === playerId);
  }

  /** Whether a player was hurt during this hand. */
  injured(playerId: string): boolean {
    return !!this.#injured(playerId);
  }

  /** Move the game clock down between plays. It never runs backwards. */
  advanceClock(secondsRemaining: number): void {
    if (!this.#over) this.#clock = Math.min(this.#clock, Math.max(0, secondsRemaining));
  }

  /** Live quarter points for any player in the game. */
  points(playerId: string): number {
    return this.#injured(playerId)?.points ?? this.#scorer.points(this.options.qtr, playerId);
  }

  card(playerId: string): Card {
    const card = this.#cards.get(playerId);
    if (!card) throw new Error(`no card for ${playerId}`);
    return card;
  }

  /** A card's value: face plus weighted live points (MISSION.md Q1). */
  value(playerId: string): number {
    return roundValue(this.card(playerId).face + this.rules.liveWeight * this.points(playerId));
  }

  cards(seatId: string): readonly string[] { return this.#seat(seatId).cards; }
  frozen(seatId: string): boolean { return this.#seat(seatId).frozenAt !== null; }
  burned(seatId: string): boolean { return this.#seat(seatId).burns === 0; }
  burnsLeft(seatId: string): number { return this.#seat(seatId).burns; }

  total(seatId: string): number {
    const seat = this.#seat(seatId);
    return seat.frozenAt ?? roundValue(seat.cards.reduce((sum, c) => sum + this.value(c), 0));
  }

  canAct(seatId: string): boolean {
    return this.#refusal(this.#seat(seatId)) === null;
  }

  /** Draw another player. Free, with no card limit (MISSION.md Q4). */
  hit(seatId: string): string {
    const seat = this.#acting(seatId);
    const card = this.#drawFor(seat);
    seat.cards.push(card);
    return card;
  }

  /** Swap one card for a new draw, once per hand, before Freeze (MISSION.md Q5). */
  burn(seatId: string, playerId: string): string {
    const seat = this.#acting(seatId);
    if (seat.burns === 0) throw new ActionRefused("burn_used");
    const at = seat.cards.indexOf(playerId);
    if (at < 0) throw new ActionRefused("not_in_hand");
    const card = this.#drawFor(seat, playerId);
    seat.cards[at] = card;
    seat.burns--;
    return card;
  }

  /** Lock the total. The hand takes no more actions (MISSION.md Q3). */
  freeze(seatId: string): number {
    const seat = this.#acting(seatId);
    seat.frozenAt = this.total(seatId);
    return seat.frozenAt;
  }

  view(seatId: string): SeatView {
    const seat = this.#seat(seatId);
    const { periodStart, lockout } = this.options;
    const closes = Math.max(lockout, 0);
    const deck = [...this.#cards.values()];
    return {
      cards: seat.cards.map((c) => ({ playerId: c, value: this.value(c), projection: this.card(c).projection })),
      total: this.total(seatId),
      frozen: seat.frozenAt !== null,
      burned: seat.burns === 0,
      burnsLeft: seat.burns,
      canAct: this.#refusal(seat) === null,
      timeLeft: Math.max(0, (this.#clock - closes) / (periodStart - closes)),
      clock: this.#clock,
      lockout,
      deckAverage: {
        face: deck.reduce((s, c) => s + c.face, 0) / deck.length,
        projection: deck.reduce((s, c) => s + c.projection, 0) / deck.length,
      },
      liveWeight: this.rules.liveWeight,
    };
  }

  settle(): Settlement {
    if (!this.#over) throw new Error("the hand is still live");
    if (this.#voided) throw new Error("a void hand does not settle");
    const { mode, dealerSeat, ante } = this.options;
    const finishes = [...this.#seats.keys()].map((seatId) => ({ seatId, total: this.total(seatId) }));
    if (mode === "players") return settlePlayers(finishes, ante, this.rules.rake);
    const dealer = finishes.find((f) => f.seatId === dealerSeat)!;
    return settleDealer(finishes.filter((f) => f !== dealer), dealer, ante);
  }

  #seat(seatId: string): SeatState {
    const seat = this.#seats.get(seatId);
    if (!seat) throw new ActionRefused("unknown_seat");
    return seat;
  }

  #refusal(seat: SeatState): RefusalReason | null {
    if (this.#over) return "settled";
    if (seat.frozenAt !== null) return "frozen";
    if (this.locked) return "locked";
    return null;
  }

  #acting(seatId: string): SeatState {
    const seat = this.#seat(seatId);
    const refusal = this.#refusal(seat);
    if (refusal) throw new ActionRefused(refusal);
    return seat;
  }

  /** A card not already in this hand (or the one being burned). Other hands may hold it too. */
  #drawFor(seat: SeatState, excluding?: string): string {
    const deck = this.options.deck;
    for (;;) {
      const card = deck[Math.floor(seat.draw() * deck.length)]!.playerId;
      if (!seat.cards.includes(card) && card !== excluding && !this.#injured(card)) return card;
    }
  }
}
