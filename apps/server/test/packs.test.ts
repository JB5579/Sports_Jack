import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packFor, TIERS } from "@sportsjack/engine";
import { MAX_CREDITS, type PackSource } from "../src/packs.ts";
import { Store } from "../src/store.ts";
import { parseVariants } from "../src/variants.ts";

/** A finished quarter: 30 players worth 2 to 8.5. */
const source: PackSource = {
  gameId: "g1", qtr: 2, edition: "SEA at NE · Q2",
  deck: Array.from({ length: 30 }, (_, i) => ({ playerId: `p${i}`, name: `Player ${i}`, team: i % 2 ? "SEA" : "NE", position: "WR", value: 2 + (i % 14) * 0.5 })),
};

const fresh = () => new Store(":memory:", parseVariants("variation=C;rewards=off"));

describe("hit for a pack", () => {
  it("deals two cards, hits, and opens a pack on a stop between 16 and 21", () => {
    const store = fresh();
    const { id } = store.account("device-token-pack-000001");
    let won = 0, busted = 0, short = 0;
    for (let i = 0; i < 40; i++) {
      store.packs.earn(id);
      store.packs.start(id, source);
      let s = store.packs.state(id);
      expect(s.run!.cards.length).toBeGreaterThanOrEqual(2);
      while (s.run!.status === "live" && s.run!.total < 16) { store.packs.hit(id); s = store.packs.state(id); }
      if (s.run!.status === "live") { store.packs.stop(id); s = store.packs.state(id); }
      if (s.run!.status === "won") {
        won++;
        expect(s.run!.pack).toBe(packFor(s.run!.total)!.name);
        expect(s.run!.opened).toHaveLength(3);
        expect(new Set(s.run!.opened.map((c) => c.name)).size).toBe(3);
        for (const c of s.run!.opened) expect(TIERS.map((t) => t.id)).toContain(c.tier);
      } else if (s.run!.status === "bust") { busted++; expect(s.run!.total).toBeGreaterThan(21); } else short++;
    }
    expect(won).toBeGreaterThan(0);
    expect(won + busted + short).toBe(40);
    expect(store.packs.state(id).collection).toHaveLength(won * 3);
  });

  it("stopping short of 16 wins nothing", () => {
    const store = fresh();
    const { id } = store.account("device-token-pack-000002");
    store.packs.start(id, { ...source, deck: source.deck.map((c) => ({ ...c, value: 2 })) });
    store.packs.stop(id);
    expect(store.packs.state(id).run).toMatchObject({ status: "short", total: 4, pack: null, opened: [] });
  });

  it("sells a card back once, for its tier's chips, through the ledger", () => {
    const store = fresh();
    const { id } = store.account("device-token-pack-000003");
    const high = { ...source, deck: source.deck.map((c) => ({ ...c, value: 10 })) }; // any two cards make 20: a gold pack
    store.packs.start(id, high);
    store.packs.stop(id);
    const [card] = store.packs.state(id).collection;
    const chips = store.packs.sell(id, card!.id);
    expect(chips).toBe(card!.chips);
    expect(store.balance(id)).toBe(1000 + chips);
    expect(() => store.packs.sell(id, card!.id)).toThrow(/already_sold/);
    expect(store.packs.state(id).collection).toHaveLength(2);
    expect(store.audit()).toMatchObject({ ok: true, totals: { chips: 0 } });
  });

  it("spends a run per start, banks at most five, and refuses with none left", () => {
    const store = fresh();
    const { id } = store.account("device-token-pack-000004");
    expect(store.packs.credits(id)).toBe(1); // today's free run
    for (let i = 0; i < 9; i++) store.packs.earn(id);
    expect(store.packs.credits(id)).toBe(MAX_CREDITS);
    for (let i = 0; i < MAX_CREDITS; i++) { store.packs.start(id, source); if (store.packs.state(id).run!.status === "live") store.packs.stop(id); }
    expect(() => store.packs.start(id, source)).toThrow(/no_runs_left/);
  });

  it("gives the run back when the server restarts mid-run", () => {
    const dir = mkdtempSync(join(tmpdir(), "sj-packs-"));
    try {
      const first = new Store(join(dir, "db.sqlite"), parseVariants("variation=C"));
      const { id } = first.account("device-token-pack-000005");
      first.packs.start(id, source);
      expect(first.packs.credits(id)).toBe(0);
      first.close();
      const second = new Store(join(dir, "db.sqlite"), parseVariants("variation=C"));
      expect(second.packs.state(id)).toMatchObject({ credits: 1, run: { status: "refunded" } });
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("earns a run for each real hand played on variation C", () => {
    const store = fresh();
    const { id } = store.account("device-token-pack-000006");
    store.packs.start(id, { ...source, deck: source.deck.map((c) => ({ ...c, value: 2 })) });
    store.packs.stop(id);
    expect(store.packs.credits(id)).toBe(0);
    store.debit(id, 25, "ante", "h1");
    store.recordHand({ id: "h1", tableId: "t1", gameId: "g1", qtr: 1, seed: 1, commitment: "c", ruleset: "alpha-2", settlement: {}, log: [],
      seats: [{ accountId: id, cards: [], total: 18, ante: 25, payout: 0 }] });
    expect(store.packs.credits(id)).toBe(1);
  });
});
