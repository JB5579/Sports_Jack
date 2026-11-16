import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { Ledger, LedgerError, SYSTEM, pot } from "../src/index.ts";

function setup() {
  const db = new DatabaseSync(":memory:");
  const ledger = new Ledger(db, () => "2026-11-16T00:00:00.000Z");
  ledger.open("ann", "player");
  ledger.open("bob", "player");
  ledger.transfer({ key: "issue:ann", kind: "issue", from: SYSTEM.issuance, to: "ann", amount: 1000 });
  ledger.transfer({ key: "issue:bob", kind: "issue", from: SYSTEM.issuance, to: "bob", amount: 1000 });
  return { db, ledger };
}

const code = (work: () => unknown) => {
  try { work(); } catch (error) { return error instanceof LedgerError ? error.code : String(error); }
  return "no error";
};

describe("ledger", () => {
  it("moves value without making or losing any", () => {
    const { ledger } = setup();
    expect(ledger.balance("ann")).toBe(1000);
    expect(ledger.balance(SYSTEM.issuance)).toBe(-2000);
    expect(ledger.audit()).toEqual({ ok: true, unbalanced: [], drifted: [], overdrawn: [], totals: { chips: 0 } });
  });

  it("settles a hand through its pot: antes in, payouts out, the rest to the house", () => {
    const { ledger } = setup();
    ledger.open(pot("h1"), "system");
    ledger.transfer({ key: "ante:h1:ann", kind: "ante", ref: "h1", from: "ann", to: pot("h1"), amount: 100 });
    ledger.transfer({ key: "ante:h1:bob", kind: "ante", ref: "h1", from: "bob", to: pot("h1"), amount: 100 });
    ledger.post({ key: "settle:h1", kind: "settle", ref: "h1", entries: [
      { account: pot("h1"), amount: -200 }, { account: "ann", amount: 180 }, { account: SYSTEM.table, amount: 20 }] });
    expect([ledger.balance("ann"), ledger.balance("bob"), ledger.balance(pot("h1")), ledger.balance(SYSTEM.table)]).toEqual([1080, 900, 0, 20]);
    expect(ledger.audit().ok).toBe(true);
    expect(ledger.statement("ann").map((r) => [r.kind, r.amount, r.ref])).toEqual([["settle", 180, "h1"], ["ante", -100, "h1"], ["issue", 1000, null]]);
  });

  it("posts a key once, however often it is sent", () => {
    const { ledger } = setup();
    const ante = () => ledger.transfer({ key: "ante:h1:ann", kind: "ante", from: "ann", to: SYSTEM.table, amount: 100 });
    expect(ante()).toBe(true);
    expect(ante()).toBe(false);
    expect(ledger.balance("ann")).toBe(900);
    expect(ledger.posted("ante:h1:ann")).toBe(true);
  });

  it("refuses a transaction that does not sum to zero, and changes nothing", () => {
    const { ledger } = setup();
    expect(code(() => ledger.post({ key: "bad", kind: "x", entries: [{ account: "ann", amount: -100 }, { account: "bob", amount: 90 }] }))).toBe("unbalanced");
    expect(ledger.posted("bad")).toBe(false);
    expect(ledger.balance("ann")).toBe(1000);
  });

  it("never takes a player below zero, but lets a system account issue", () => {
    const { ledger } = setup();
    expect(code(() => ledger.transfer({ key: "big", kind: "ante", from: "ann", to: "bob", amount: 1001 }))).toBe("insufficient");
    expect(ledger.balance("ann")).toBe(1000);
    expect(ledger.balance("bob")).toBe(1000);
    expect(ledger.transfer({ key: "all", kind: "ante", from: "ann", to: "bob", amount: 1000 })).toBe(true);
    expect(ledger.balance("ann")).toBe(0);
  });

  it("refuses fractions, zero amounts, single entries and unknown accounts", () => {
    const { ledger } = setup();
    expect(code(() => ledger.transfer({ key: "a", kind: "x", from: "ann", to: "bob", amount: 0.5 }))).toBe("invalid");
    expect(code(() => ledger.transfer({ key: "b", kind: "x", from: "ann", to: "bob", amount: 0 }))).toBe("invalid");
    expect(code(() => ledger.post({ key: "c", kind: "x", entries: [{ account: "ann", amount: 1 }] }))).toBe("invalid");
    expect(code(() => ledger.transfer({ key: "d", kind: "x", from: "ann", to: "nobody", amount: 5 }))).toBe("unknown_account");
    expect(ledger.audit().ok).toBe(true);
  });

  it("is append-only: the database refuses to change or delete history", () => {
    const { db, ledger } = setup();
    expect(() => db.exec("UPDATE ledger_entries SET amount = 5000 WHERE account_id = 'ann'")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM ledger_entries")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM ledger_tx")).toThrow(/append-only/);
    expect(ledger.balance("ann")).toBe(1000);
  });

  it("audit catches a balance that no entry explains", () => {
    const { db, ledger } = setup();
    db.exec("UPDATE ledger_balances SET balance = 5000 WHERE account_id = 'ann'");
    const report = ledger.audit();
    expect(report.ok).toBe(false);
    expect(report.drifted).toEqual(["ann chips"]);
    expect(report.totals.chips).toBe(4000);
  });

  it("keeps currencies apart", () => {
    const { ledger } = setup();
    ledger.transfer({ key: "prize:1", kind: "prize", currency: "usd_cents", from: SYSTEM.issuance, to: "ann", amount: 500 });
    expect(ledger.balance("ann")).toBe(1000);
    expect(ledger.balance("ann", "usd_cents")).toBe(500);
    expect(code(() => ledger.transfer({ key: "spend", kind: "x", currency: "usd_cents", from: "bob", to: "ann", amount: 1 }))).toBe("insufficient");
    expect(ledger.audit().totals).toEqual({ chips: 0, usd_cents: 0 });
  });

  it("rolls a failed step back together with everything in the same atomic block", () => {
    const { ledger } = setup();
    expect(code(() => ledger.atomic(() => {
      ledger.transfer({ key: "one", kind: "x", from: "ann", to: "bob", amount: 10 });
      ledger.transfer({ key: "two", kind: "x", from: "ann", to: "bob", amount: 5000 });
    }))).toBe("insufficient");
    expect(ledger.posted("one")).toBe(false);
    expect(ledger.balance("bob")).toBe(1000);
  });
});
