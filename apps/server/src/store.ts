import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
 * Play-money accounts, the ledger and settled hands. Balances are integer yards and
 * change only together with a ledger row.
 */
export class Store {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, balance INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY, account_id TEXT NOT NULL, amount INTEGER NOT NULL,
        reason TEXT NOT NULL, hand_id TEXT, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS hands (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, game_id TEXT NOT NULL, qtr INTEGER NOT NULL,
        seed INTEGER NOT NULL, commitment TEXT NOT NULL, ruleset TEXT NOT NULL, settlement TEXT NOT NULL, log TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS hand_seats (hand_id TEXT NOT NULL, account_id TEXT NOT NULL, cards TEXT NOT NULL,
        total REAL NOT NULL, ante INTEGER NOT NULL, payout INTEGER NOT NULL, PRIMARY KEY (hand_id, account_id));
    `);
  }

  /**
   * The play-money account behind a device token, created on first use. Sign-up and login
   * are a human decision (MISSION.md); until then a device-scoped token is the identity.
   */
  account(token: string): Account {
    const id = createHash("sha256").update(`sportsjack:${token}`).digest("hex").slice(0, 16);
    const row = this.#db.prepare("SELECT id, balance FROM accounts WHERE id = ?").get(id) as Account | undefined;
    if (row) return { id: row.id, balance: Number(row.balance) };
    this.#tx(() => {
      this.#db.prepare("INSERT INTO accounts (id, balance, created_at) VALUES (?, 0, ?)").run(id, now());
      this.#move(id, START_BALANCE, "starting play-money yards", null);
    });
    return { id, balance: START_BALANCE };
  }

  balance(accountId: string): number {
    const row = this.#db.prepare("SELECT balance FROM accounts WHERE id = ?").get(accountId) as { balance: number } | undefined;
    if (!row) throw new Error(`no account ${accountId}`);
    return Number(row.balance);
  }

  /** Take an ante. Returns false, changing nothing, when the balance is too low. */
  debit(accountId: string, amount: number, reason: string, handId: string): boolean {
    let ok = false;
    this.#tx(() => {
      if (this.balance(accountId) < amount) return;
      this.#move(accountId, -amount, reason, handId);
      ok = true;
    });
    return ok;
  }

  recordHand(hand: HandRecord): void {
    this.#tx(() => {
      this.#db.prepare("INSERT INTO hands (id, table_id, game_id, qtr, seed, commitment, ruleset, settlement, log, at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(hand.id, hand.tableId, hand.gameId, hand.qtr, hand.seed, hand.commitment, hand.ruleset,
          JSON.stringify(hand.settlement), JSON.stringify(hand.log), now());
      for (const s of hand.seats) {
        this.#db.prepare("INSERT INTO hand_seats (hand_id, account_id, cards, total, ante, payout) VALUES (?,?,?,?,?,?)")
          .run(hand.id, s.accountId, JSON.stringify(s.cards), s.total, s.ante, s.payout);
        if (s.payout > 0) this.#move(s.accountId, s.payout, "hand payout", hand.id);
      }
    });
  }

  history(accountId: string, limit = 30): HistoryRow[] {
    return (this.#db.prepare(`
      SELECT h.id, h.game_id AS gameId, h.qtr, h.seed, h.commitment, s.total, s.ante, s.payout, h.at
      FROM hand_seats s JOIN hands h ON h.id = s.hand_id WHERE s.account_id = ? ORDER BY h.at DESC, h.rowid DESC LIMIT ?`)
      .all(accountId, limit) as Omit<HistoryRow, "net">[]).map((r) => ({ ...r, net: r.payout - r.ante }));
  }

  /** Sum of every ledger row for an account; equals its balance. */
  ledgerTotal(accountId: string): number {
    const row = this.#db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM ledger WHERE account_id = ?").get(accountId) as { total: number };
    return Number(row.total);
  }

  close(): void { this.#db.close(); }

  #move(accountId: string, amount: number, reason: string, handId: string | null): void {
    this.#db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, accountId);
    this.#db.prepare("INSERT INTO ledger (account_id, amount, reason, hand_id, at) VALUES (?,?,?,?,?)").run(accountId, amount, reason, handId, now());
  }

  #depth = 0;
  #tx(work: () => void): void {
    if (this.#depth > 0) { work(); return; }
    this.#depth++;
    this.#db.exec("BEGIN");
    try { work(); this.#db.exec("COMMIT"); } catch (error) { this.#db.exec("ROLLBACK"); throw error; } finally { this.#depth--; }
  }
}

const now = () => new Date().toISOString();
