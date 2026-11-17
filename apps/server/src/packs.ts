import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { CARDS_PER_PACK, packFor, PACKS, roundValue, RUN_TARGET, seededRandom, tierFor, TIERS, type PackId } from "@sportsjack/engine";
import type { Ledger } from "@sportsjack/ledger";

/**
 * Variation C: hit for a pack, and a collection of player cards (prd/FOUNDATION.md,
 * "Collectibles"). Everything is play money and free: runs are earned, never bought.
 *
 * A run deals real player cards from a quarter that has just finished in a game being
 * played, valued as that quarter scored them (face + live points × the live weight). The
 * player hits or stops: stopping on 16–21 wins a pack of three collectible cards, and a
 * tighter landing wins a better pack. Pack cards never play in hands; each sells back for
 * its tier's chips, paid from `house:collectibles`.
 */

/** A card in a run: a real player and what he was worth in the source quarter. */
export interface SourceCard { playerId: string; name: string; team: string; position: string; value: number }
/** The quarter a run deals from. */
export interface PackSource { gameId: string; qtr: number; edition: string; deck: SourceCard[] }

export const COLLECTIBLES = "house:collectibles";
/** Runs a player can bank: one a day, and one per real hand played. */
export const MAX_CREDITS = 5;

interface RunRow { id: string; account_id: string; edition: string; seed: number; deck: string; drawn: number; status: string; total: number; pack: string | null }

export class Packs {
  readonly #db: DatabaseSync;
  readonly #ledger: Ledger;
  readonly #now: () => Date;

  constructor(db: DatabaseSync, ledger: Ledger, now: () => Date = () => new Date()) {
    this.#db = db;
    this.#ledger = ledger;
    this.#now = now;
    db.exec(`
      CREATE TABLE IF NOT EXISTS pack_credits (account_id TEXT PRIMARY KEY, credits INTEGER NOT NULL, daily TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pack_runs (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, game_id TEXT NOT NULL, qtr INTEGER NOT NULL,
        edition TEXT NOT NULL, seed INTEGER NOT NULL, deck TEXT NOT NULL, drawn INTEGER NOT NULL, status TEXT NOT NULL,
        total REAL NOT NULL, pack TEXT, created_at TEXT NOT NULL, finished_at TEXT);
      CREATE TABLE IF NOT EXISTS collectibles (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, run_id TEXT NOT NULL, player_id TEXT NOT NULL,
        name TEXT NOT NULL, team TEXT NOT NULL, position TEXT NOT NULL, tier TEXT NOT NULL, edition TEXT NOT NULL, created_at TEXT NOT NULL, sold_at TEXT);
    `);
    ledger.open(COLLECTIBLES, "system");
    // A run left live by a restart never finished: give the credit back (MVP edge-case rules).
    for (const r of db.prepare("SELECT id, account_id FROM pack_runs WHERE status = 'live'").all() as { id: string; account_id: string }[]) {
      db.prepare("UPDATE pack_runs SET status = 'refunded', finished_at = ? WHERE id = ?").run(this.#stamp(), r.id);
      this.#addCredit(r.account_id, 1);
    }
  }

  /** A real hand settled: one more run, up to the cap. */
  earn(accountId: string): void {
    this.#addCredit(accountId, 1);
  }

  /** Runs available now, with today's free one added the first time it is asked for each day. */
  credits(accountId: string): number {
    const today = this.#stamp().slice(0, 10);
    const row = this.#db.prepare("SELECT credits, daily FROM pack_credits WHERE account_id = ?").get(accountId) as { credits: number; daily: string } | undefined;
    if (!row) {
      this.#db.prepare("INSERT INTO pack_credits (account_id, credits, daily) VALUES (?, 1, ?)").run(accountId, today);
      return 1;
    }
    if (row.daily !== today) {
      const credits = Math.min(MAX_CREDITS, Number(row.credits) + 1);
      this.#db.prepare("UPDATE pack_credits SET credits = ?, daily = ? WHERE account_id = ?").run(credits, today, accountId);
      return credits;
    }
    return Number(row.credits);
  }

  /** Start a run on a finished quarter, spending one credit. Two cards are dealt at once. */
  start(accountId: string, source: PackSource): void {
    if (this.#live(accountId)) throw new Error("run_in_progress");
    if (this.credits(accountId) < 1) throw new Error("no_runs_left");
    if (source.deck.length < 4) throw new Error("no_quarter_yet");
    this.#addCredit(accountId, -1);
    const id = `run-${Date.now().toString(36)}-${randomInt(0, 2 ** 31).toString(36)}`;
    const seed = randomInt(0, 2 ** 31);
    const cards = drawn(seed, source.deck, 2);
    this.#db.prepare("INSERT INTO pack_runs (id, account_id, game_id, qtr, edition, seed, deck, drawn, status, total, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, accountId, source.gameId, source.qtr, source.edition, seed, JSON.stringify(source.deck), 2, "live", total(cards), this.#stamp());
    this.#settleIfBust(accountId);
  }

  /** Draw another card. Going over 21 ends the run with nothing. */
  hit(accountId: string): void {
    const run = this.#live(accountId);
    if (!run) throw new Error("no_run");
    const deck = JSON.parse(run.deck) as SourceCard[];
    const cards = drawn(run.seed, deck, run.drawn + 1);
    this.#db.prepare("UPDATE pack_runs SET drawn = ?, total = ? WHERE id = ?").run(cards.length, total(cards), run.id);
    this.#settleIfBust(accountId);
  }

  /** Stop. On 16–21 the run wins a pack, opened at once into the collection. */
  stop(accountId: string): void {
    const run = this.#live(accountId);
    if (!run) throw new Error("no_run");
    const pack = packFor(run.total);
    if (!pack) { this.#finish(run.id, "short", null); return; }
    const deck = JSON.parse(run.deck) as SourceCard[];
    const rand = seededRandom(run.seed ^ 0x9acc);
    const used = new Set<string>();
    for (let i = 0; i < CARDS_PER_PACK; i++) {
      const tier = tierFor(pack.id, rand());
      let player = deck[Math.floor(rand() * deck.length)]!;
      // Three different players in a pack.
      while (used.has(player.playerId) && used.size < deck.length) player = deck[Math.floor(rand() * deck.length)]!;
      used.add(player.playerId);
      this.#db.prepare("INSERT INTO collectibles (id, account_id, run_id, player_id, name, team, position, tier, edition, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(`${run.id}-${i}`, accountId, run.id, player.playerId, player.name, player.team, player.position, tier.id, run.edition, this.#stamp());
    }
    this.#finish(run.id, "won", pack.id);
  }

  /** Sell a card back for its tier's chips. A card sells once. */
  sell(accountId: string, cardId: string): number {
    const card = this.#db.prepare("SELECT tier, sold_at FROM collectibles WHERE id = ? AND account_id = ?").get(cardId, accountId) as { tier: string; sold_at: string | null } | undefined;
    if (!card) throw new Error("unknown_card");
    if (card.sold_at) throw new Error("already_sold");
    const chips = TIERS.find((t) => t.id === card.tier)!.chips;
    this.#ledger.atomic(() => {
      this.#ledger.transfer({ key: `sell:${cardId}`, kind: "sell_back", ref: cardId, from: COLLECTIBLES, to: accountId, amount: chips });
      this.#db.prepare("UPDATE collectibles SET sold_at = ? WHERE id = ?").run(this.#stamp(), cardId);
    });
    return chips;
  }

  /** What the phone shows: runs left, the live or last run, and the collection. */
  state(accountId: string) {
    const credits = this.credits(accountId);
    const last = this.#db.prepare("SELECT * FROM pack_runs WHERE account_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(accountId) as RunRow | undefined;
    const run = last && {
      id: last.id, edition: last.edition, status: last.status as "live" | "won" | "bust" | "short" | "refunded", total: roundValue(Number(last.total)),
      cards: drawn(Number(last.seed), JSON.parse(last.deck) as SourceCard[], Number(last.drawn)),
      pack: last.pack ? PACKS.find((p) => p.id === last.pack)!.name : null,
      opened: last.status === "won" ? this.#cards(accountId, last.id) : [],
    };
    return {
      credits, maxCredits: MAX_CREDITS, target: RUN_TARGET, run: run ?? null,
      packs: PACKS.map((p) => ({ name: p.name, from: p.from })), tiers: TIERS,
      collection: this.#cards(accountId, null),
    };
  }

  #cards(accountId: string, runId: string | null) {
    const rows = (runId
      ? this.#db.prepare("SELECT * FROM collectibles WHERE account_id = ? AND run_id = ? ORDER BY id").all(accountId, runId)
      : this.#db.prepare("SELECT * FROM collectibles WHERE account_id = ? AND sold_at IS NULL ORDER BY created_at DESC, id").all(accountId)) as Record<string, string>[];
    return rows.map((r) => {
      const tier = TIERS.find((t) => t.id === r.tier)!;
      return { id: r.id!, name: r.name!, team: r.team!, position: r.position!, edition: r.edition!, tier: tier.id, tierName: tier.name, chips: tier.chips, sold: !!r.sold_at };
    });
  }

  #live(accountId: string): RunRow | undefined {
    const row = this.#db.prepare("SELECT * FROM pack_runs WHERE account_id = ? AND status = 'live'").get(accountId) as RunRow | undefined;
    return row && { ...row, seed: Number(row.seed), drawn: Number(row.drawn), total: Number(row.total) };
  }

  #settleIfBust(accountId: string): void {
    const run = this.#live(accountId);
    if (run && roundValue(run.total) > 21) this.#finish(run.id, "bust", null);
  }

  #finish(runId: string, status: string, pack: PackId | null): void {
    this.#db.prepare("UPDATE pack_runs SET status = ?, pack = ?, finished_at = ? WHERE id = ?").run(status, pack, this.#stamp(), runId);
  }

  #addCredit(accountId: string, n: number): void {
    const have = this.credits(accountId);
    this.#db.prepare("UPDATE pack_credits SET credits = ? WHERE account_id = ?").run(Math.max(0, Math.min(MAX_CREDITS, have + n)), accountId);
  }

  #stamp(): string {
    return this.#now().toISOString();
  }
}

/** The first `n` cards a run's seed deals from its deck: no player twice. Replays exactly. */
export function drawn(seed: number, deck: SourceCard[], n: number): SourceCard[] {
  const rand = seededRandom(seed);
  const out: SourceCard[] = [];
  while (out.length < Math.min(n, deck.length)) {
    const card = deck[Math.floor(rand() * deck.length)]!;
    if (!out.some((c) => c.playerId === card.playerId)) out.push(card);
  }
  return out;
}

const total = (cards: SourceCard[]) => roundValue(cards.reduce((sum, c) => sum + c.value, 0));
