import { createHash, randomInt } from "node:crypto";
import type { FeedEvent, StatDelta, StatKey } from "@sportsjack/feed";
import {
  ActionRefused, decide, Hand, seededRandom,
  type Card, type DealerLevel, type Settlement, type TableMode,
} from "@sportsjack/engine";
import type { GameRunner } from "./runner.ts";
import type { Store } from "./store.ts";

export interface TableSpec {
  id: string;
  gameId: string;
  mode: TableMode;
  ante: number;
  /** Seconds left in the quarter when Hit, Burn and Freeze close; 0 for none. */
  lockout: number;
  /** Dealer strength at a dealer table; the bots' mix at a player table. */
  level: DealerLevel;
  openedBy: string | null;
  /** A free, private onboarding hand: no ante, not saved, not listed in the lobby. */
  practice?: boolean;
}

export const LOCKOUTS = [0, 30, 60, 120];
export const ANTES = [25, 100, 1000];
const PLAYER_TABLE_SEATS = 4;
const BOT_NAMES = ["Gridiron Gus", "Two-Minute Tia", "Red Zone Ray", "Blitz Becky", "Hail Mary Hal"];
const AI_THINK_SECONDS = 15;

interface AiSeat { id: string; name: string; level: DealerLevel; dealer: boolean; nextThink: number; lastAct: string }

export interface PlayNote { seq: number; qtr: number; clock: number; description: string; changes: [string, number][] }

export type Action = { type: "hit" } | { type: "freeze" } | { type: "burn"; playerId: string };

export class ActionError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; }
}

/**
 * One table on one replayed game. Players sit between quarters; each quarter it deals a
 * hand to every seated player who can cover the ante, runs the AI seats, settles at the
 * whistle and records the hand.
 */
export class Table {
  readonly spec: TableSpec;
  readonly #runner: GameRunner;
  readonly #store: Store;
  readonly #deck: Card[];
  readonly #onChange: () => void;
  readonly seated = new Set<string>();
  readonly pending = new Set<string>();
  readonly #leaving = new Set<string>();
  hand: Hand | null = null;
  handId: string | null = null;
  commitment: string | null = null;
  #seed = 0;
  #ai: AiSeat[] = [];
  #aiRandom: () => number = Math.random;
  #humans: string[] = [];
  #plays: PlayNote[] = [];
  #descriptions = new Map<string, string>();
  /** Each player's stats this quarter, for the card grid's stat lines. */
  #stats = new Map<string, StatDelta>();
  result: { handId: string; qtr: number; seed: number; settlement: Settlement; names: Record<string, string> } | null = null;

  constructor(spec: TableSpec, runner: GameRunner, store: Store, deck: Card[], onChange: () => void) {
    this.spec = spec;
    this.#runner = runner;
    this.#store = store;
    this.#deck = deck;
    this.#onChange = onChange;
    runner.on("quarter_start", (q: number) => this.#deal(q));
    runner.on("event", (e: FeedEvent) => this.#apply(e));
    runner.on("tick", (clock: number) => this.#tick(clock));
  }

  get humans(): readonly string[] { return this.#humans; }

  /** Sit down. During a quarter the seat takes effect at the next break (MISSION.md Q8). */
  sit(accountId: string): "seated" | "next_break" {
    this.#leaving.delete(accountId);
    if (this.seated.has(accountId)) return "seated";
    if (this.#runner.phase === "quarter") { this.pending.add(accountId); return "next_break"; }
    this.seated.add(accountId);
    return "seated";
  }

  /** Leave. A live hand stays in play and settles at the whistle. */
  leave(accountId: string): void {
    this.pending.delete(accountId);
    if (this.hand && !this.hand.over && this.#humans.includes(accountId)) this.#leaving.add(accountId);
    else this.seated.delete(accountId);
  }

  act(accountId: string, action: Action): void {
    const hand = this.hand;
    if (!hand || !this.#humans.includes(accountId)) throw new ActionError("not_in_hand");
    try {
      if (action.type === "hit") hand.hit(accountId);
      else if (action.type === "freeze") hand.freeze(accountId);
      else hand.burn(accountId, action.playerId);
    } catch (error) {
      if (error instanceof ActionRefused) throw new ActionError(error.reason);
      throw error;
    }
    this.#onChange();
  }

  #deal(qtr: number): void {
    for (const id of this.pending) this.seated.add(id);
    this.pending.clear();
    this.result = null;
    this.hand = null;
    this.#plays = [];
    this.#stats = new Map();
    const handId = `${this.spec.id}-q${qtr}-${Date.now().toString(36)}`;
    const humans = [...this.seated].filter((id) => this.spec.practice || this.#store.debit(id, this.spec.ante, "ante", handId));
    if (humans.length === 0) { this.#onChange(); return; }
    this.#seed = randomInt(0, 2 ** 31);
    this.commitment = createHash("sha256").update(String(this.#seed)).digest("hex");
    this.#aiRandom = seededRandom(this.#seed ^ 0x5eed);
    const period = this.#runner.periods.find((p) => p.q === qtr)!;
    this.#ai = this.spec.mode === "dealer"
      ? [{ id: "dealer", name: `House dealer · ${this.spec.level === "sharp" ? "Sharp" : "Easy"}`, level: this.spec.level, dealer: true, nextThink: 0, lastAct: "Dealt" }]
      : BOT_NAMES.slice(0, Math.max(1, PLAYER_TABLE_SEATS - humans.length)).map((name, i) => ({
        id: `bot-${i + 1}`, name, level: (i % 2 === 1 ? "sharp" : this.spec.level) as DealerLevel, dealer: false, nextThink: 0, lastAct: "Dealt",
      }));
    for (const s of this.#ai) s.nextThink = period.start - 8 - this.#aiRandom() * 12;
    this.#humans = humans;
    this.handId = handId;
    this.hand = new Hand({
      gameId: this.spec.gameId, qtr, periodStart: period.start, lockout: this.spec.lockout, ante: this.spec.ante,
      mode: this.spec.mode, deck: this.#deck, seats: [...humans, ...this.#ai.map((s) => s.id)],
      ...(this.spec.mode === "dealer" ? { dealerSeat: "dealer" } : {}), seed: this.#seed,
    });
    this.#onChange();
  }

  #apply(e: FeedEvent): void {
    if (e.kind === "play") {
      this.#descriptions.set(e.playId, e.description);
      for (const d of e.deltas) {
        const line = this.#stats.get(d.playerId) ?? {};
        for (const [key, value] of Object.entries(d.stats) as [StatKey, number][]) line[key] = (line[key] ?? 0) + value;
        this.#stats.set(d.playerId, line);
      }
    }
    const hand = this.hand;
    if (!hand || hand.over) return;
    const before = hand.log.length;
    hand.apply(e);
    if (e.kind === "play") {
      const changes = hand.log.slice(before).map((c) => [c.playerId, c.points] as [string, number]);
      this.#plays.unshift({ seq: e.seq, qtr: e.clock.qtr, clock: e.clock.quarterSecondsRemaining, description: e.description, changes });
      this.#plays.length = Math.min(this.#plays.length, 40);
    }
    this.#think();
    if (hand.over) this.#settle();
    this.#onChange();
  }

  #tick(clock: number): void {
    const hand = this.hand;
    if (!hand || hand.over) return;
    hand.advanceClock(clock);
    this.#think();
    this.#onChange(); // the clock moved; phones redraw it (pushes are batched every 200 ms)
  }

  /** AI seats decide from their SeatView only (MISSION.md invariant 6). */
  #think(): boolean {
    const hand = this.hand!;
    let acted = false;
    for (const s of this.#ai) {
      if (hand.clock > s.nextThink) continue;
      s.nextThink = hand.clock - AI_THINK_SECONDS;
      const d = decide(hand.view(s.id), s.level, this.#aiRandom);
      if (!d) continue;
      if (d.action === "hit") hand.hit(s.id);
      else if (d.action === "freeze") hand.freeze(s.id);
      else hand.burn(s.id, d.playerId);
      s.lastAct = d.action === "hit" ? "Hit" : d.action === "freeze" ? "Frozen" : "Burned";
      acted = true;
    }
    return acted;
  }

  #settle(): void {
    const hand = this.hand!;
    const settlement = hand.settle();
    const payout = new Map(settlement.standings.map((s) => [s.seatId, s.payout]));
    if (!this.spec.practice) this.#store.recordHand({
      id: this.handId!, tableId: this.spec.id, gameId: this.spec.gameId, qtr: hand.options.qtr,
      seed: this.#seed, commitment: this.commitment!, ruleset: hand.rules.id, settlement, log: hand.log,
      seats: this.#humans.map((id) => ({ accountId: id, cards: [...hand.cards(id)], total: hand.total(id), ante: this.spec.ante, payout: payout.get(id) ?? 0 })),
    });
    for (const id of this.#humans) {
      this.#store.addEvents(id, [{ name: "hand_settled", props: { handId: this.handId, gameId: this.spec.gameId, qtr: hand.options.qtr,
        practice: !!this.spec.practice, mode: this.spec.mode, total: hand.total(id), cards: hand.cards(id).length, ante: this.spec.ante, payout: payout.get(id) ?? 0 } }]);
    }
    const names: Record<string, string> = {};
    for (const s of this.#ai) names[s.id] = s.name;
    this.result = { handId: this.handId!, qtr: hand.options.qtr, seed: this.#seed, settlement, names };
    for (const id of this.#leaving) this.seated.delete(id);
    this.#leaving.clear();
  }

  /** Everything one player's screen needs. Other hands show totals and counts, not cards. */
  view(accountId: string | null) {
    const hand = this.hand;
    const status = this.#runner.status();
    const card = (playerId: string) => {
      const c = hand!.card(playerId);
      const last = hand!.log.findLast((l) => l.playerId === playerId);
      return {
        playerId, name: c.name, position: c.position, team: c.team, face: c.face, projection: c.projection,
        points: hand!.points(playerId), value: hand!.value(playerId), stats: this.#stats.get(playerId) ?? {},
        why: last ? { clock: last.clock, points: last.points, description: this.#descriptions.get(last.playId) ?? "" } : null,
      };
    };
    const mine = accountId && hand && this.#humans.includes(accountId) ? accountId : null;
    return {
      table: { ...this.spec, seated: this.seated.size, pending: this.pending.size },
      game: status,
      you: {
        seated: accountId ? this.seated.has(accountId) : false,
        joiningNextBreak: accountId ? this.pending.has(accountId) : false,
      },
      hand: hand ? {
        id: this.handId, qtr: hand.options.qtr, clock: hand.clock, lockout: hand.options.lockout, locked: hand.locked,
        over: hand.over, commitment: this.commitment, paused: status.paused,
        mine: mine ? {
          cards: hand.cards(mine).map(card), total: hand.total(mine), frozen: hand.frozen(mine),
          burned: hand.burned(mine), canAct: hand.canAct(mine),
        } : null,
        others: [
          ...this.#humans.filter((id) => id !== mine).map((id) => ({ name: "Player", bot: false, dealer: false, cards: hand.cards(id).length, total: hand.total(id), frozen: hand.frozen(id), lastAct: "" })),
          ...this.#ai.map((s) => ({ name: s.name, bot: !s.dealer, dealer: s.dealer, cards: hand.cards(s.id).length, total: hand.total(s.id), frozen: hand.frozen(s.id), lastAct: s.lastAct })),
        ],
        plays: this.#plays.slice(0, 12).map((p) => ({ ...p, changes: p.changes.map(([id, pts]) => ({ playerId: id, name: hand.card(id).name, points: pts, mine: !!mine && hand.cards(mine).includes(id) })) })),
      } : null,
      result: this.result ? {
        handId: this.result.handId, qtr: this.result.qtr, seed: this.result.seed, pot: this.result.settlement.pot, house: this.result.settlement.house,
        standings: this.result.settlement.standings.map((s) => ({
          name: s.seatId === accountId ? "You" : this.result!.names[s.seatId] ?? "Player",
          you: s.seatId === accountId, bot: s.seatId.startsWith("bot-"), dealer: s.seatId === "dealer", total: s.total, bust: s.bust, rank: s.rank, payout: s.payout,
        })),
      } : null,
    };
  }
}

export type TableView = ReturnType<Table["view"]>;
export type CardView = NonNullable<NonNullable<TableView["hand"]>["mine"]>["cards"][number];
