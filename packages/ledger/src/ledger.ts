import type { DatabaseSync } from "node:sqlite";

/**
 * A double-entry ledger (prd/FOUNDATION.md §1).
 *
 * Every movement is a transaction of two or more entries that sum to zero per currency, so
 * value is only ever moved, never made or lost. Value enters from a named system account
 * (for example `house:issuance`), which goes negative by exactly what it has issued.
 * Transactions and entries are append-only: a mistake is corrected by a new, opposite
 * transaction. Amounts are whole units of a currency (chips today).
 */

export type AccountKind = "player" | "system";

export interface Entry {
  account: string;
  /** Signed whole units: positive credits the account, negative debits it. */
  amount: number;
}

export interface Posting {
  /** Idempotency key. Posting the same key twice changes nothing the second time. */
  key: string;
  /** What kind of movement this is: `issue`, `ante`, `settle`, `prize`, `referral`... */
  kind: string;
  currency?: string;
  /** What the movement belongs to, such as a hand or contest id. */
  ref?: string | null;
  meta?: Record<string, unknown>;
  entries: Entry[];
}

export interface LedgerRow {
  tx: string;
  kind: string;
  ref: string | null;
  currency: string;
  amount: number;
  at: string;
}

export interface AuditReport {
  ok: boolean;
  /** Transactions whose entries do not sum to zero. */
  unbalanced: string[];
  /** Accounts whose stored balance differs from the sum of their entries. */
  drifted: string[];
  /** Player accounts below zero. */
  overdrawn: string[];
  /** Per currency, the sum of every balance; zero when nothing was made or lost. */
  totals: Record<string, number>;
}

export class LedgerError extends Error {
  readonly code: "invalid" | "unbalanced" | "unknown_account" | "insufficient";
  constructor(code: LedgerError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "LedgerError";
  }
}

/** System accounts every deployment has. Others (a pot per hand) are opened on demand. */
export const SYSTEM = {
  /** Where play-money chips come from: starting chips, bonuses, top-ups. */
  issuance: "house:issuance",
  /** The house side of settled hands: the dealer's wins and losses, and the rake. */
  table: "house:table",
} as const;

export const pot = (ref: string) => `pot:${ref}`;

export class Ledger {
  readonly #db: DatabaseSync;
  readonly #clock: () => string;
  #depth = 0;

  constructor(db: DatabaseSync, clock: () => string = () => new Date().toISOString()) {
    this.#db = db;
    this.#clock = clock;
    db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_accounts (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('player','system')), created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger_balances (account_id TEXT NOT NULL, currency TEXT NOT NULL, balance INTEGER NOT NULL,
        PRIMARY KEY (account_id, currency));
      CREATE TABLE IF NOT EXISTS ledger_tx (id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, currency TEXT NOT NULL,
        ref TEXT, meta TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger_entries (id INTEGER PRIMARY KEY, tx_id INTEGER NOT NULL REFERENCES ledger_tx(id),
        account_id TEXT NOT NULL REFERENCES ledger_accounts(id), amount INTEGER NOT NULL CHECK (amount <> 0));
      CREATE INDEX IF NOT EXISTS ledger_entries_account ON ledger_entries (account_id, id);
      CREATE INDEX IF NOT EXISTS ledger_tx_ref ON ledger_tx (ref);
      CREATE TRIGGER IF NOT EXISTS ledger_tx_no_update BEFORE UPDATE ON ledger_tx BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS ledger_tx_no_delete BEFORE DELETE ON ledger_tx BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS ledger_entries_no_update BEFORE UPDATE ON ledger_entries BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS ledger_entries_no_delete BEFORE DELETE ON ledger_entries BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
    `);
    for (const id of Object.values(SYSTEM)) this.open(id, "system");
  }

  /** Run `work` as one database transaction. Nested calls join the outer one. */
  atomic<T>(work: () => T): T {
    if (this.#depth > 0) return work();
    this.#depth++;
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    } finally {
      this.#depth--;
    }
  }

  /** Open an account if it does not exist. An account's kind never changes. */
  open(id: string, kind: AccountKind): void {
    this.#db.prepare("INSERT OR IGNORE INTO ledger_accounts (id, kind, created_at) VALUES (?,?,?)").run(id, kind, this.#clock());
  }

  has(id: string): boolean {
    return this.#db.prepare("SELECT 1 FROM ledger_accounts WHERE id = ?").get(id) !== undefined;
  }

  balance(account: string, currency = "chips"): number {
    const row = this.#db.prepare("SELECT balance FROM ledger_balances WHERE account_id = ? AND currency = ?").get(account, currency) as { balance: number } | undefined;
    return row ? Number(row.balance) : 0;
  }

  /** True when a transaction with this key has been posted. */
  posted(key: string): boolean {
    return this.#db.prepare("SELECT 1 FROM ledger_tx WHERE key = ?").get(key) !== undefined;
  }

  /**
   * Post a transaction. Returns false, changing nothing, when its key was already posted.
   * Throws `LedgerError` and changes nothing when the entries do not sum to zero, name an
   * unknown account, or would take a player account below zero.
   */
  post(p: Posting): boolean {
    const currency = p.currency ?? "chips";
    if (!p.key || !p.kind) throw new LedgerError("invalid", "a posting needs a key and a kind");
    if (p.entries.length < 2) throw new LedgerError("invalid", `${p.key}: a transaction needs at least two entries`);
    let sum = 0;
    const net = new Map<string, number>();
    for (const e of p.entries) {
      if (!Number.isSafeInteger(e.amount) || e.amount === 0) throw new LedgerError("invalid", `${p.key}: amounts are non-zero whole units, got ${e.amount}`);
      sum += e.amount;
      net.set(e.account, (net.get(e.account) ?? 0) + e.amount);
    }
    if (sum !== 0) throw new LedgerError("unbalanced", `${p.key}: entries sum to ${sum}, not 0`);

    return this.atomic(() => {
      if (this.posted(p.key)) return false;
      for (const [account, change] of net) {
        const row = this.#db.prepare("SELECT kind FROM ledger_accounts WHERE id = ?").get(account) as { kind: AccountKind } | undefined;
        if (!row) throw new LedgerError("unknown_account", `${p.key}: no account ${account}`);
        if (row.kind === "player" && this.balance(account, currency) + change < 0) {
          throw new LedgerError("insufficient", `${p.key}: ${account} has ${this.balance(account, currency)} ${currency}, needs ${-change}`);
        }
      }
      const tx = this.#db.prepare("INSERT INTO ledger_tx (key, kind, currency, ref, meta, at) VALUES (?,?,?,?,?,?)")
        .run(p.key, p.kind, currency, p.ref ?? null, JSON.stringify(p.meta ?? {}), this.#clock());
      for (const e of p.entries) {
        this.#db.prepare("INSERT INTO ledger_entries (tx_id, account_id, amount) VALUES (?,?,?)").run(tx.lastInsertRowid, e.account, e.amount);
      }
      for (const [account, change] of net) {
        if (change === 0) continue;
        this.#db.prepare(`INSERT INTO ledger_balances (account_id, currency, balance) VALUES (?,?,?)
          ON CONFLICT (account_id, currency) DO UPDATE SET balance = balance + excluded.balance`).run(account, currency, change);
      }
      return true;
    });
  }

  /** Move `amount` from one account to another: the common two-entry transaction. */
  transfer(t: Omit<Posting, "entries"> & { from: string; to: string; amount: number }): boolean {
    const { from, to, amount, ...rest } = t;
    if (!(amount > 0)) throw new LedgerError("invalid", `${t.key}: a transfer moves a positive amount, got ${amount}`);
    return this.post({ ...rest, entries: [{ account: from, amount: -amount }, { account: to, amount }] });
  }

  /** An account's statement, newest first. */
  statement(account: string, limit = 100): LedgerRow[] {
    return (this.#db.prepare(`SELECT t.key AS tx, t.kind, t.ref, t.currency, e.amount, t.at FROM ledger_entries e JOIN ledger_tx t ON t.id = e.tx_id
      WHERE e.account_id = ? ORDER BY e.id DESC LIMIT ?`).all(account, limit) as unknown as LedgerRow[]).map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  /** Sum of an account's entries, straight from the entries. Equals `balance` unless the books have drifted. */
  entriesTotal(account: string, currency = "chips"): number {
    const row = this.#db.prepare(`SELECT COALESCE(SUM(e.amount), 0) AS total FROM ledger_entries e JOIN ledger_tx t ON t.id = e.tx_id
      WHERE e.account_id = ? AND t.currency = ?`).get(account, currency) as { total: number };
    return Number(row.total);
  }

  /** Check the books from the entries up. Reads only. */
  audit(): AuditReport {
    const col = (sql: string) => (this.#db.prepare(sql).all() as { id: string }[]).map((r) => String(r.id));
    const unbalanced = col("SELECT t.key AS id FROM ledger_tx t JOIN ledger_entries e ON e.tx_id = t.id GROUP BY t.id HAVING SUM(e.amount) <> 0");
    const drifted = col(`
      SELECT s.account_id || ' ' || s.currency AS id FROM (
        SELECT e.account_id, t.currency, SUM(e.amount) AS total FROM ledger_entries e JOIN ledger_tx t ON t.id = e.tx_id GROUP BY e.account_id, t.currency) s
      LEFT JOIN ledger_balances b ON b.account_id = s.account_id AND b.currency = s.currency WHERE COALESCE(b.balance, 0) <> s.total
      UNION
      SELECT b.account_id || ' ' || b.currency FROM ledger_balances b WHERE b.balance <> 0 AND NOT EXISTS (
        SELECT 1 FROM ledger_entries e JOIN ledger_tx t ON t.id = e.tx_id WHERE e.account_id = b.account_id AND t.currency = b.currency)`);
    const overdrawn = col("SELECT b.account_id || ' ' || b.currency AS id FROM ledger_balances b JOIN ledger_accounts a ON a.id = b.account_id WHERE a.kind = 'player' AND b.balance < 0");
    const totals: Record<string, number> = {};
    for (const r of this.#db.prepare("SELECT currency, SUM(balance) AS total FROM ledger_balances GROUP BY currency").all() as { currency: string; total: number }[]) {
      totals[r.currency] = Number(r.total);
    }
    const ok = !unbalanced.length && !drifted.length && !overdrawn.length && Object.values(totals).every((t) => t === 0);
    return { ok, unbalanced, drifted, overdrawn, totals };
  }
}
