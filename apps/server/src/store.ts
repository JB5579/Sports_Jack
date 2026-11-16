import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Ledger, LedgerError, SYSTEM, pot } from "@sportsjack/ledger";
import type { AuditReport, LedgerRow } from "@sportsjack/ledger";
import { bucket, SWITCHES, switchDef, type Weights } from "./variants.ts";

export const START_BALANCE = 1000;

export interface Account {
  id: string;
  balance: number;
}

export interface HandRecord {
  id: string;
  tableId: string;
  gameId: string;
  qtr: number;
  seed: number;
  commitment: string;
  ruleset: string;
  settlement: unknown;
  log: unknown;
  /** The contest the hand was played for (entry, prizes, deal). */
  contest?: unknown;
  /**
   * Who pays what the pot does not cover, and receives what is left in it. The house table
   * by default; a sponsor account for a sponsored pool.
   */
  fundedBy?: { account: string; kind: string };
  seats: { accountId: string; cards: string[]; total: number; payout: number; ante: number }[];
}

export interface HistoryRow {
  id: string;
  gameId: string;
  qtr: number;
  seed: number;
  commitment: string;
  total: number;
  ante: number;
  payout: number;
  net: number;
  at: string;
}

/**
 * Play-money accounts and settled hands. Every chip movement is a transaction in the
 * double-entry ledger (`@sportsjack/ledger`): starting chips come from `house:issuance`,
 * antes go into the hand's pot, and settlement pays the pot out, with the difference
 * going to or coming from `house:table`.
 */
export class Store {
  readonly #db: DatabaseSync;
  readonly ledger: Ledger;
  readonly #weights: Weights;

  constructor(path: string, weights: Weights = {}) {
    this.#weights = weights;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, balance INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS hands (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, game_id TEXT NOT NULL, qtr INTEGER NOT NULL,
        seed INTEGER NOT NULL, commitment TEXT NOT NULL, ruleset TEXT NOT NULL, settlement TEXT NOT NULL, log TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS hand_seats (hand_id TEXT NOT NULL, account_id TEXT NOT NULL, cards TEXT NOT NULL,
        total REAL NOT NULL, ante INTEGER NOT NULL, payout INTEGER NOT NULL, PRIMARY KEY (hand_id, account_id));
      CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY, account_id TEXT NOT NULL, rating INTEGER,
        note TEXT NOT NULL, name TEXT NOT NULL, screen TEXT NOT NULL, hand_id TEXT, game_id TEXT, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL,
        props TEXT NOT NULL, at TEXT NOT NULL);
    `);
    this.#db.exec(`CREATE TABLE IF NOT EXISTS variant_assignments (account_id TEXT NOT NULL, switch TEXT NOT NULL, value TEXT NOT NULL,
      source TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (account_id, switch))`);
    // Columns added after the first release; older databases get them on start.
    const columns = (table: string) => (this.#db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    if (!columns("hands").includes("contest")) this.#db.exec("ALTER TABLE hands ADD COLUMN contest TEXT NOT NULL DEFAULT '{}'");
    if (!columns("hand_seats").includes("variants")) this.#db.exec("ALTER TABLE hand_seats ADD COLUMN variants TEXT NOT NULL DEFAULT '{}'");
    this.ledger = new Ledger(this.#db);
    this.#migrate();
  }

  /**
   * Bring accounts from before the double-entry ledger onto it: each one's balance at the
   * time becomes an opening transaction. Runs once per account; `accounts.balance` is not
   * read or written after that.
   */
  #migrate(): void {
    const old = this.#db.prepare("SELECT id, balance FROM accounts").all() as unknown as Account[];
    this.ledger.atomic(() => {
      for (const a of old) {
        if (this.ledger.has(a.id)) continue;
        this.ledger.open(a.id, "player");
        if (Number(a.balance) > 0) {
          this.ledger.transfer({ key: `opening:${a.id}`, kind: "opening", from: SYSTEM.issuance, to: a.id, amount: Number(a.balance),
            meta: { note: "balance carried over from the single-entry ledger" } });
        }
      }
    });
  }

  /**
   * The play-money account behind a device token, created on first use. Sign-up and login
   * are a human decision (MISSION.md); until then a device-scoped token is the identity.
   */
  account(token: string): Account {
    const id = createHash("sha256").update(`sportsjack:${token}`).digest("hex").slice(0, 16);
    if (!this.ledger.has(id)) {
      this.#tx(() => {
        this.#db.prepare("INSERT INTO accounts (id, balance, created_at) VALUES (?, 0, ?)").run(id, now());
        this.ledger.open(id, "player");
        this.ledger.transfer({ key: `start:${id}`, kind: "issue", from: SYSTEM.issuance, to: id, amount: START_BALANCE,
          meta: { note: "starting play-money chips" } });
      });
    }
    this.variants(id);
    return { id, balance: this.ledger.balance(id) };
  }

  /**
   * A player's variant switches (prd/FOUNDATION.md §4). Each switch is assigned once, from
   * the owner's weights, and kept: changing the weights later moves only new players.
   */
  variants(accountId: string): Record<string, string> {
    const rows = this.#db.prepare("SELECT switch, value FROM variant_assignments WHERE account_id = ?").all(accountId) as { switch: string; value: string }[];
    const out: Record<string, string> = Object.fromEntries(rows.map((r) => [r.switch, r.value]));
    for (const def of SWITCHES) {
      if (def.scope !== "player" || out[def.name]) continue;
      const value = bucket(accountId, def, this.#weights);
      out[def.name] = value;
      this.#db.prepare("INSERT OR IGNORE INTO variant_assignments (account_id, switch, value, source, at) VALUES (?,?,?,?,?)")
        .run(accountId, def.name, value, "weights", now());
    }
    return out;
  }

  /** The owner puts a player on a value by hand, for example to show a variation to a tester. */
  setVariant(accountId: string, name: string, value: string): void {
    const def = switchDef(name);
    if (!def || def.scope !== "player") throw new Error(`unknown player switch ${name}`);
    if (!def.values.includes(value)) throw new Error(`${name} has no value ${value}`);
    if (!this.ledger.has(accountId)) throw new Error(`no account ${accountId}`);
    this.#db.prepare(`INSERT INTO variant_assignments (account_id, switch, value, source, at) VALUES (?,?,?,?,?)
      ON CONFLICT (account_id, switch) DO UPDATE SET value = excluded.value, source = excluded.source, at = excluded.at`).run(accountId, name, value, "owner", now());
  }

  /** How many players are on each value of each player switch. */
  variantCounts(): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const def of SWITCHES.filter((d) => d.scope === "player")) out[def.name] = Object.fromEntries(def.values.map((v) => [v, 0]));
    for (const r of this.#db.prepare("SELECT switch, value, COUNT(*) AS n FROM variant_assignments GROUP BY switch, value").all() as { switch: string; value: string; n: number }[]) {
      if (out[r.switch]) out[r.switch]![r.value] = Number(r.n);
    }
    return out;
  }

  balance(accountId: string): number {
    if (!this.ledger.has(accountId)) throw new Error(`no account ${accountId}`);
    return this.ledger.balance(accountId);
  }

  /**
   * Take an ante into the hand's pot. Returns false, changing nothing, when the balance is
   * too low. Asking twice for the same hand and account takes it once.
   */
  debit(accountId: string, amount: number, reason: string, handId: string): boolean {
    try {
      this.#tx(() => {
        this.ledger.open(pot(handId), "system");
        this.ledger.transfer({ key: `${reason}:${handId}:${accountId}`, kind: reason, ref: handId, from: accountId, to: pot(handId), amount });
      });
      return true;
    } catch (error) {
      if (error instanceof LedgerError && error.code === "insufficient") return false;
      throw error;
    }
  }

  recordHand(hand: HandRecord): void {
    this.#tx(() => {
      this.#db.prepare("INSERT INTO hands (id, table_id, game_id, qtr, seed, commitment, ruleset, settlement, log, contest, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .run(hand.id, hand.tableId, hand.gameId, hand.qtr, hand.seed, hand.commitment, hand.ruleset,
          JSON.stringify(hand.settlement), JSON.stringify(hand.log), JSON.stringify(hand.contest ?? {}), now());
      for (const s of hand.seats) {
        this.#db.prepare("INSERT INTO hand_seats (hand_id, account_id, cards, total, ante, payout, variants) VALUES (?,?,?,?,?,?,?)")
          .run(hand.id, s.accountId, JSON.stringify(s.cards), s.total, s.ante, s.payout, JSON.stringify(this.variants(s.accountId)));
      }
      // Pay the pot out. Bots and the dealer hold no accounts, so their side of the hand,
      // and the rake, is the difference between the pot and the payouts, which goes to or
      // comes from `house:table`. A sponsored pool has no pot: the sponsor pays the prizes.
      const funder = hand.fundedBy ?? { account: SYSTEM.table, kind: "settle" };
      this.ledger.open(funder.account, "system");
      const inPot = this.ledger.balance(pot(hand.id));
      const entries = hand.seats.filter((s) => s.payout > 0).map((s) => ({ account: s.accountId, amount: s.payout }));
      const paid = entries.reduce((sum, e) => sum + e.amount, 0);
      if (inPot !== 0) entries.push({ account: pot(hand.id), amount: -inPot });
      if (inPot !== paid) entries.push({ account: funder.account, amount: inPot - paid });
      if (entries.length > 0) {
        this.ledger.open(pot(hand.id), "system");
        this.ledger.post({ key: `settle:${hand.id}`, kind: funder.kind, ref: hand.id, entries });
      }
    });
  }

  history(accountId: string, limit = 30): HistoryRow[] {
    return (this.#db.prepare(`
      SELECT h.id, h.game_id AS gameId, h.qtr, h.seed, h.commitment, s.total, s.ante, s.payout, h.at
      FROM hand_seats s JOIN hands h ON h.id = s.hand_id WHERE s.account_id = ? ORDER BY h.at DESC, h.rowid DESC LIMIT ?`)
      .all(accountId, limit) as Omit<HistoryRow, "net">[]).map((r) => ({ ...r, net: r.payout - r.ante }));
  }

  /** Sum of every ledger entry for an account; equals its balance. */
  ledgerTotal(accountId: string): number {
    return this.ledger.entriesTotal(accountId);
  }

  /** An account's chip movements, newest first. */
  statement(accountId: string, limit = 100): LedgerRow[] {
    return this.ledger.statement(accountId, limit);
  }

  /** Check the books: every transaction sums to zero and every balance matches its entries. */
  audit(): AuditReport {
    return this.ledger.audit();
  }

  /** A tester's feedback: a 1–5 rating and/or a note, with where they were in the app. */
  addFeedback(accountId: string, f: { rating: number | null; note: string; name: string; screen: string; handId: string | null; gameId: string | null }): void {
    this.#db.prepare("INSERT INTO feedback (account_id, rating, note, name, screen, hand_id, game_id, at) VALUES (?,?,?,?,?,?,?,?)")
      .run(accountId, f.rating, f.note, f.name, f.screen, f.handId, f.gameId, now());
  }

  /** Usage events, from the phone or logged by the server itself. */
  addEvents(accountId: string, events: { name: string; props?: Record<string, unknown> }[]): void {
    this.#tx(() => {
      const variants = this.variants(accountId);
      for (const e of events) {
        this.#db.prepare("INSERT INTO events (account_id, name, props, at) VALUES (?,?,?,?)").run(accountId, e.name, JSON.stringify({ ...e.props, variants }), now());
      }
    });
  }

  feedbackRows(): Record<string, unknown>[] {
    return this.#db.prepare("SELECT id, account_id AS accountId, rating, note, name, screen, hand_id AS handId, game_id AS gameId, at FROM feedback ORDER BY id").all() as Record<string, unknown>[];
  }

  eventRows(): Record<string, unknown>[] {
    return this.#db.prepare("SELECT id, account_id AS accountId, name, props, at FROM events ORDER BY id").all() as Record<string, unknown>[];
  }

  /** The PRD's success numbers for a test round (PRD §15). */
  testSummary() {
    const one = (sql: string) => Number((this.#db.prepare(sql).get() as Record<string, number>).n);
    type Row = { account: string; tableId: string; gameId: string; qtr: number; at: string; variants: string };
    const hands = this.#db.prepare(`SELECT s.account_id AS account, h.table_id AS tableId, h.game_id AS gameId, h.qtr, h.at, s.variants
      FROM hand_seats s JOIN hands h ON h.id = s.hand_id ORDER BY h.at`).all() as Row[];
    // A hand "continues" when the same player plays the next quarter at the same table within 30 minutes.
    const continuation = (subset: Row[]) => {
      let eligible = 0, continued = 0;
      for (const h of subset) {
        if (h.qtr >= 4) continue;
        eligible++;
        const t = Date.parse(h.at);
        if (hands.some((n) => n.account === h.account && n.tableId === h.tableId && n.qtr === h.qtr + 1 && Date.parse(n.at) > t && Date.parse(n.at) - t < 30 * 60_000)) continued++;
      }
      return eligible ? Math.round((continued / eligible) * 1000) / 10 : null;
    };
    // The same numbers for each value of each player switch, by the switches recorded on each hand.
    const byVariant: Record<string, Record<string, { players: number; realHands: number; quarterToQuarterContinuation: number | null }>> = {};
    for (const def of SWITCHES.filter((d) => d.scope === "player")) {
      byVariant[def.name] = {};
      for (const value of def.values) {
        const subset = hands.filter((h) => (JSON.parse(h.variants || "{}") as Record<string, string>)[def.name] === value);
        byVariant[def.name]![value] = { players: new Set(subset.map((h) => h.account)).size, realHands: subset.length, quarterToQuarterContinuation: continuation(subset) };
      }
    }
    const players = one("SELECT COUNT(DISTINCT account_id) AS n FROM events");
    return {
      players,
      practiceStarted: one("SELECT COUNT(DISTINCT account_id) AS n FROM events WHERE name = 'practice_start'"),
      practiceFinished: one("SELECT COUNT(DISTINCT account_id) AS n FROM events WHERE name = 'practice_finish'"),
      playersWithARealHand: one("SELECT COUNT(DISTINCT account_id) AS n FROM hand_seats"),
      realHands: hands.length,
      quarterToQuarterContinuation: continuation(hands),
      byVariant,
      actions: Object.fromEntries((this.#db.prepare("SELECT name, COUNT(*) AS n FROM events WHERE name IN ('hit','burn','freeze') GROUP BY name").all() as { name: string; n: number }[]).map((r) => [r.name, Number(r.n)])),
      feedback: one("SELECT COUNT(*) AS n FROM feedback"),
      averageRating: (() => { const r = this.#db.prepare("SELECT AVG(rating) AS n FROM feedback WHERE rating IS NOT NULL").get() as { n: number | null }; return r.n === null ? null : Math.round(r.n * 100) / 100; })(),
    };
  }

  close(): void { this.#db.close(); }

  #tx(work: () => void): void {
    this.ledger.atomic(work);
  }
}

const now = () => new Date().toISOString();
