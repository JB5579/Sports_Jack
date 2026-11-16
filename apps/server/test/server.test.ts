import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { configFromEnv, type ServerConfig } from "../src/config.ts";
import { createSportsJackServer, type SportsJackServer } from "../src/server.ts";

const running: { server: SportsJackServer; dir: string }[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) { await r.server.close(); rmSync(r.dir, { recursive: true, force: true }); }
});

async function start(overrides: Partial<ServerConfig> = {}, dir = mkdtempSync(join(tmpdir(), "sj-"))) {
  const config: ServerConfig = {
    ...configFromEnv({}), port: 0, db: join(dir, "sj.sqlite"), games: ["2025_22_SEA_NE"],
    // Rewards off by default, so settlement tests see only the hand's own payouts; the rewards tests turn them on.
    speed: 60, breakSeconds: 5, loop: false, clock: "manual", testControls: true, candidate: "candidate-abc", variants: "rewards=off", ...overrides,
  };
  const server = createSportsJackServer(config);
  const port = await server.listen();
  running.push({ server, dir });
  return { server, port, dir, lobby: server.lobby };
}

/** A phone: a WebSocket that remembers every message by type. */
async function phone(port: number, token: string) {
  const socket = new WebSocket(`ws://localhost:${port}/ws`);
  const seen: Record<string, unknown>[] = [];
  const waiters: [(m: Record<string, unknown>) => boolean, (m: Record<string, unknown>) => void][] = [];
  socket.on("message", (raw) => {
    const m = JSON.parse(String(raw));
    seen.push(m);
    // A message handed to a waiting test is used up; don't let a later wait match it again.
    for (const w of [...waiters]) if (w[0](m)) { waiters.splice(waiters.indexOf(w), 1); seen.splice(seen.indexOf(m), 1); w[1](m); break; }
  });
  await new Promise((r) => socket.once("open", r));
  const next = (match: (m: Record<string, unknown>) => boolean) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const found = seen.find(match);
      if (found) { seen.splice(seen.indexOf(found), 1); return resolve(found); }
      waiters.push([match, resolve]);
      setTimeout(() => reject(new Error("no matching message")), 3000);
    });
  const send = (m: Record<string, unknown>) => socket.send(JSON.stringify(m));
  send({ type: "hello", token });
  const welcome = await next((m) => m.type === "welcome");
  return { socket, send, next, welcome, seen };
}

const tokenA = "device-token-aaaaaaaaaaaa";
const tokenB = "device-token-bbbbbbbbbbbb";
const quarter = (lobby: SportsJackServer["lobby"], seconds: number) => { for (let i = 0; i < seconds; i++) lobby.advance(1); };
/** Advance one real second at a time until the table's hand settles at the whistle. */
const untilSettled = (lobby: SportsJackServer["lobby"], table: { result: unknown }) => {
  for (let i = 0; i < 100 && !table.result; i++) lobby.advance(1);
  if (!table.result) throw new Error("the hand never settled");
};

describe("SportsJack server", () => {
  it("answers health and build identity", async () => {
    const { port } = await start();
    expect(await (await fetch(`http://localhost:${port}/health`)).json()).toEqual({ status: "ok" });
    expect(await (await fetch(`http://localhost:${port}/build-id`)).text()).toBe("candidate-abc");
  });

  it("plays one quarter against the dealer on Super Bowl LX and settles it in the ledger", async () => {
    const { port, lobby } = await start();
    const p = await phone(port, tokenA);
    const account = p.welcome.account as { id: string; balance: number };
    expect(account.balance).toBe(1000);
    const table = [...lobby.tables.values()].find((t) => t.spec.mode === "dealer" && t.spec.ante === 25)!;
    p.send({ type: "sit", tableId: table.spec.id });
    expect(await p.next((m) => m.type === "sat")).toMatchObject({ status: "seated" });

    quarter(lobby, 6); // the break ends; Q1 is dealt
    expect(lobby.store.balance(account.id)).toBe(975);
    const dealt = table.view(account.id).hand!.mine!;
    expect(dealt.cards).toHaveLength(2);
    for (const c of dealt.cards) expect(["SEA", "NE"]).toContain(c.team);

    let moved = false;
    const values = () => table.view(account.id).hand!.mine!.cards.map((c) => c.value).join();
    const first = values();
    for (let i = 0; i < 5; i++) { quarter(lobby, 1); if (values() !== first) moved = true; }
    p.send({ type: "hit" });
    await p.next((m) => m.type === "table" && (m.hand as { mine?: { cards: unknown[] } } | null)?.mine?.cards.length === 3);

    untilSettled(lobby, table);
    const view = table.view(account.id);
    expect(view.hand!.over).toBe(true);
    expect(view.result).not.toBeNull();
    const me = view.result!.standings.find((s) => s.you)!;
    expect(lobby.store.balance(account.id)).toBe(975 + me.payout);
    expect(lobby.store.ledgerTotal(account.id)).toBe(lobby.store.balance(account.id));
    const [hand] = lobby.store.history(account.id);
    expect(hand!.qtr).toBe(1);
    expect(hand!.commitment).toBe(createHash("sha256").update(String(hand!.seed)).digest("hex"));
    expect(moved || first !== values()).toBe(true);
  });

  it("seats a player who sits mid-quarter at the next break, not in the live hand", async () => {
    const { port, lobby } = await start();
    const table = [...lobby.tables.values()][0]!;
    const a = await phone(port, tokenA);
    a.send({ type: "sit", tableId: table.spec.id });
    await a.next((m) => m.type === "sat");
    quarter(lobby, 8);
    const b = await phone(port, tokenB);
    b.send({ type: "sit", tableId: table.spec.id });
    expect(await b.next((m) => m.type === "sat")).toMatchObject({ status: "next_break" });
    const bId = (b.welcome.account as { id: string }).id;
    expect(table.humans).not.toContain(bId);
    quarter(lobby, 20 + 6); // finish Q1, the break, deal Q2
    expect(table.humans).toContain(bId);
  });

  it("gives a reconnecting phone the same hand", async () => {
    const { port, lobby } = await start();
    const table = [...lobby.tables.values()][0]!;
    const first = await phone(port, tokenA);
    first.send({ type: "sit", tableId: table.spec.id });
    await first.next((m) => m.type === "sat");
    quarter(lobby, 7);
    const handId = table.handId;
    first.socket.terminate();
    const again = await phone(port, tokenA);
    const view = await again.next((m) => m.type === "table") as { hand: { id: string; mine: { cards: { playerId: string }[] } } };
    expect(view.hand.id).toBe(handId);
    expect(view.hand.mine.cards.map((c) => c.playerId)).toEqual(table.hand!.cards((again.welcome.account as { id: string }).id));
  });

  it("holds the hand while the feed is paused and settles after it resumes", async () => {
    const { port, lobby } = await start();
    const table = [...lobby.tables.values()][0]!;
    const p = await phone(port, tokenA);
    p.send({ type: "sit", tableId: table.spec.id });
    await p.next((m) => m.type === "sat");
    quarter(lobby, 8);
    await fetch(`http://localhost:${port}/test/replay/pause?game=2025_22_SEA_NE`, { method: "POST" });
    const clock = table.hand!.clock;
    quarter(lobby, 60);
    expect(table.hand!.clock).toBe(clock);
    expect(table.hand!.over).toBe(false);
    expect(table.view(null).hand!.paused).toBe(true);
    await fetch(`http://localhost:${port}/test/replay/resume?game=2025_22_SEA_NE`, { method: "POST" });
    untilSettled(lobby, table);
    expect(table.hand!.over).toBe(true);
    expect(table.hand!.options.qtr).toBe(1);
  });

  it("keeps balances and settled hands across a restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sj-"));
    const first = await start({}, dir);
    const p = await phone(first.port, tokenA);
    const id = (p.welcome.account as { id: string }).id;
    const table = [...first.lobby.tables.values()][0]!;
    p.send({ type: "sit", tableId: table.spec.id });
    await p.next((m) => m.type === "sat");
    quarter(first.lobby, 30);
    const balance = first.lobby.store.balance(id);
    await first.server.close();
    running.splice(running.findIndex((r) => r.server === first.server), 1);
    const second = await start({}, dir);
    expect(second.lobby.store.balance(id)).toBe(balance);
    expect(second.lobby.store.history(id)).toHaveLength(1);
    // The books balance after a settled hand: nothing was made or lost, and the pot is empty.
    expect(second.lobby.store.audit()).toMatchObject({ ok: true, totals: { chips: 0 } });
    const moves = second.lobby.store.statement(id).map((r) => r.kind);
    expect(moves.slice(-2)).toEqual(["ante", "issue"]);
    const handId = second.lobby.store.history(id)[0]!.id;
    expect(second.lobby.store.ledger.balance(`pot:${handId}`)).toBe(0);
  });

  it("carries balances from before the double-entry ledger onto it, once", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sj-"));
    const old = new DatabaseSync(join(dir, "sj.sqlite"));
    old.exec(`CREATE TABLE accounts (id TEXT PRIMARY KEY, balance INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE ledger (id INTEGER PRIMARY KEY, account_id TEXT NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, hand_id TEXT, at TEXT NOT NULL);
      INSERT INTO accounts VALUES ('veteran', 1375, '2026-11-01T00:00:00.000Z'), ('broke', 0, '2026-11-01T00:00:00.000Z');`);
    old.close();
    const first = await start({}, dir);
    expect(first.lobby.store.balance("veteran")).toBe(1375);
    expect(first.lobby.store.balance("broke")).toBe(0);
    expect(first.lobby.store.statement("veteran").map((r) => [r.kind, r.amount])).toEqual([["opening", 1375]]);
    await first.server.close();
    running.splice(running.findIndex((r) => r.server === first.server), 1);
    const second = await start({}, dir);
    expect(second.lobby.store.balance("veteran")).toBe(1375);
    expect(second.lobby.store.audit().ok).toBe(true);
  });

  it("serves the ledger audit to the owner only", async () => {
    const { port } = await start({ adminToken: "s3cret" });
    expect((await fetch(`http://localhost:${port}/api/admin/audit`)).status).toBe(404);
    const report = await (await fetch(`http://localhost:${port}/api/admin/audit?key=s3cret`)).json() as { ok: boolean };
    expect(report.ok).toBe(true);
  });

  it("deals two players and labeled bots at a player table, and the yards add up", async () => {
    const { port, lobby } = await start({ games: ["2026_07_NE_CHI"] });
    const a = await phone(port, tokenA);
    a.send({ type: "open", gameId: "2026_07_NE_CHI", mode: "players", ante: 100, lockout: 30, level: "easy" });
    const sat = await a.next((m) => m.type === "sat") as { tableId: string };
    const b = await phone(port, tokenB);
    b.send({ type: "sit", tableId: sat.tableId });
    await b.next((m) => m.type === "sat");
    const table = lobby.tables.get(sat.tableId)!;
    expect(table.spec.lockout).toBe(30);
    const ids = [a, b].map((p) => (p.welcome.account as { id: string }).id);
    quarter(lobby, 6);
    expect(table.humans).toEqual(ids);
    const others = table.view(ids[0]!).hand!.others;
    expect(others.filter((o) => o.bot)).toHaveLength(2);
    expect(others.every((o) => o.bot || o.name === "Player")).toBe(true);
    untilSettled(lobby, table);
    const result = table.view(ids[0]!).result!;
    const bots = result.standings.filter((s) => s.bot);
    const humansAfter = ids.reduce((sum, id) => sum + lobby.store.balance(id), 0);
    const botNet = bots.reduce((sum, s) => sum + s.payout, 0) - 100 * bots.length;
    expect(humansAfter - 2000 + result.house + botNet).toBe(0);
  });

  it("deals a free practice hand at once on Super Bowl LX's fourth quarter, then cleans it up", async () => {
    const { port, lobby } = await start();
    const p = await phone(port, tokenA);
    const id = (p.welcome.account as { id: string }).id;
    p.send({ type: "practice" });
    const sat = await p.next((m) => m.type === "sat") as { tableId: string };
    const table = lobby.tables.get(sat.tableId)!;
    expect(table.spec.practice).toBe(true);
    lobby.advance(1.5);
    expect(table.hand!.options.qtr).toBe(4);
    expect(table.hand!.cards(id)).toHaveLength(2);
    expect(lobby.store.balance(id)).toBe(1000);
    expect(lobby.summary().tables.some((t) => t.id === sat.tableId)).toBe(false);
    untilSettled(lobby, table);
    expect(lobby.store.balance(id)).toBe(1000);
    expect(lobby.store.history(id)).toHaveLength(0);
    p.send({ type: "leave" });
    await p.next((m) => m.type === "lobby");
    expect(lobby.tables.has(sat.tableId)).toBe(false);
  });

  it("collects testers' feedback and play events, and exports them only with the admin key", async () => {
    const { port, lobby } = await start({ adminToken: "admin-key-123" });
    const post = (path: string, payload: unknown) => fetch(`http://localhost:${port}${path}`, { method: "POST", body: JSON.stringify(payload) });
    expect((await post("/api/feedback", { token: tokenA })).status).toBe(400);
    expect((await post("/api/feedback", { token: tokenA, rating: 9 })).status).toBe(400);
    expect((await post("/api/feedback", { token: tokenA, rating: 4, note: "Loved the TD swing", screen: "result", name: "Jo" })).status).toBe(200);
    expect((await post("/api/events", { token: tokenA, events: [{ name: "app_open", props: { standalone: true } }, { nope: 1 }] })).status).toBe(200);

    const p = await phone(port, tokenA);
    const table = [...lobby.tables.values()][0]!;
    p.send({ type: "sit", tableId: table.spec.id });
    await p.next((m) => m.type === "sat");
    quarter(lobby, 7);
    p.send({ type: "hit" });
    await p.next((m) => m.type === "table" && (m.hand as { mine?: { cards: unknown[] } } | null)?.mine?.cards.length === 3);
    untilSettled(lobby, table);

    expect((await fetch(`http://localhost:${port}/api/admin/summary`)).status).toBe(404);
    expect((await fetch(`http://localhost:${port}/api/admin/summary?key=wrong-key-123`)).status).toBe(404);
    const summary = await (await fetch(`http://localhost:${port}/api/admin/summary`, { headers: { authorization: "Bearer admin-key-123" } })).json();
    expect(summary).toMatchObject({ players: 1, playersWithARealHand: 1, realHands: 1, feedback: 1, averageRating: 4, actions: { hit: 1 } });
    const events = await (await fetch(`http://localhost:${port}/api/admin/events.csv?key=admin-key-123`)).text();
    for (const name of ["app_open", "sit", "hit", "hand_settled"]) expect(events).toContain(`,${name},`);
    expect(events).not.toContain("nope");
    const feedback = await (await fetch(`http://localhost:${port}/api/admin/feedback.csv?key=admin-key-123`)).text();
    expect(feedback).toContain("Loved the TD swing");
  });

  it("has no admin routes at all when no admin key is configured", async () => {
    const { port } = await start({ adminToken: undefined });
    expect((await fetch(`http://localhost:${port}/api/admin/summary?key=anything-at-all`)).status).toBe(404);
  });

  it("runs an NBA table on the 2026 playoffs double-overtime game with the NBA rules", async () => {
    const { port, lobby } = await start({ games: ["401873197"] });
    const runner = lobby.runners.get("401873197")!;
    expect(runner.periods.map((p) => [p.q, p.start])).toEqual([[1, 720], [2, 720], [3, 720], [4, 720], [5, 300], [6, 300]]);
    const summary = lobby.summary();
    expect(summary.games[0]).toMatchObject({ sport: "nba", home: "OKC", away: "SA", rules: { id: "alpha-nba-2", liveWeight: 0.2 } });
    const p = await phone(port, tokenA);
    const id = (p.welcome.account as { id: string }).id;
    const table = [...lobby.tables.values()][0]!;
    p.send({ type: "sit", tableId: table.spec.id });
    await p.next((m) => m.type === "sat");
    quarter(lobby, 6);
    const view = table.view(id);
    expect(view.hand).toMatchObject({ rules: "alpha-nba-2", liveWeight: 0.2 });
    for (const c of view.hand!.mine!.cards) expect(["OKC", "SA"]).toContain(c.team);
    untilSettled(lobby, table);
    expect(table.result!.qtr).toBe(1);
    expect(lobby.store.ledgerTotal(id)).toBe(lobby.store.balance(id));
  });

  it("deals an NBA practice hand on the 2026 Finals' fourth quarter when asked for NBA", async () => {
    const { port, lobby } = await start({ games: ["2025_22_SEA_NE", "401859967"] });
    const p = await phone(port, tokenA);
    const id = (p.welcome.account as { id: string }).id;
    p.send({ type: "practice", sport: "nba" });
    const sat = await p.next((m) => m.type === "sat") as { tableId: string };
    const table = lobby.tables.get(sat.tableId)!;
    expect(table.spec).toMatchObject({ gameId: "401859967", practice: true });
    lobby.advance(1.5);
    const view = table.view(id);
    expect(view.hand).toMatchObject({ qtr: 4, rules: "alpha-nba-2", clock: 720 });
    for (const c of view.hand!.mine!.cards) expect(["NY", "SA"]).toContain(c.team);
    p.send({ type: "practice" });
    const nfl = await p.next((m) => m.type === "sat") as { tableId: string };
    expect(lobby.tables.get(nfl.tableId)!.spec.gameId).toBe("2025_22_SEA_NE");
  });

  it("finishes every period of every NBA fixture game, despite ESPN's late corrections", async () => {
    const games = ["401859967", "401873197", "401909294"];
    const { lobby } = await start({ games, speed: 120, breakSeconds: 1 });
    const ended = new Map<string, number[]>(games.map((g) => [g, []]));
    for (const g of games) lobby.runners.get(g)!.on("quarter_end", (q: number) => ended.get(g)!.push(q));
    for (let i = 0; i < 120; i++) lobby.advance(1);
    for (const g of games) expect(ended.get(g), g).toEqual(lobby.runners.get(g)!.periods.map((p) => p.q));
  });

  it("shows the house dealer's whole hand, its published rule and its next look", async () => {
    const { port, lobby } = await start();
    const p = await phone(port, tokenA);
    const id = (p.welcome.account as { id: string }).id;
    const table = [...lobby.tables.values()].find((t) => t.spec.mode === "dealer" && t.spec.level === "easy")!;
    p.send({ type: "sit", tableId: table.spec.id });
    await p.next((m) => m.type === "sat");
    quarter(lobby, 7);
    const dealer = table.view(id).hand!.dealer!;
    expect(dealer.cards.length).toBeGreaterThanOrEqual(2);
    if (!dealer.frozen) expect(dealer.cards.reduce((s, c) => s + c.value, 0)).toBeCloseTo(dealer.total, 6);
    for (const c of dealer.cards) expect(c).toMatchObject({ name: expect.any(String), face: expect.any(Number), value: expect.any(Number) });
    expect(dealer.rule).toBe("Hits under 15. Freezes at 17–21 with 3:00 or less left. Otherwise rides. Looks every 15 seconds of game clock.");
    expect(dealer.nextLook! % 15).toBe(0);
    expect(dealer.nextLook!).toBeLessThan(table.hand!.clock);
    const players = [...lobby.tables.values()].find((t) => t.spec.mode === "players")!;
    expect(players.view(id).hand).toBeNull();
  });

  it("sitting at a player table deals your own table at once, with hole cards hidden and shared cards counted", async () => {
    const { port, lobby } = await start();
    const p = await phone(port, tokenA);
    const id = (p.welcome.account as { id: string }).id;
    quarter(lobby, 8); // the shared game is mid-quarter: a listed table would have made you wait
    const listed = [...lobby.tables.values()].find((t) => t.spec.mode === "players" && !t.spec.personal)!;
    p.send({ type: "sit", tableId: listed.spec.id });
    const sat = await p.next((m) => m.type === "sat") as { tableId: string; status: string };
    expect(sat.status).toBe("seated");
    const mine = lobby.tables.get(sat.tableId)!;
    expect(mine.spec).toMatchObject({ personal: true, mode: "players", ante: listed.spec.ante, lockout: listed.spec.lockout });
    expect(lobby.summary().tables.some((t) => t.id === mine.spec.id)).toBe(false);
    lobby.advance(1.5);
    expect(mine.hand!.options.qtr).toBe(2); // the quarter after the live one
    expect(lobby.store.balance(id)).toBe(1000 - listed.spec.ante);

    const view = mine.view(id).hand!;
    expect(view.others).toHaveLength(3);
    for (const o of view.others) {
      expect(o.bot).toBe(true);
      expect(o.hidden).toBe(1); // the second card, face down until Freeze or the whistle
      expect(o.total).toBeNull();
      expect(o.shown).toHaveLength(o.cards - 1);
    }
    for (const c of view.mine!.cards) {
      expect(c.sharedWith).toBe(view.others.filter((o) => o.shown.some((s) => s.playerId === c.playerId)).length);
    }

    untilSettled(lobby, mine);
    const done = mine.view(id).hand!;
    for (const o of done.others) { expect(o.hidden).toBe(0); expect(o.total).not.toBeNull(); }

    p.send({ type: "leave" });
    await p.next((m) => m.type === "lobby");
    expect(lobby.tables.has(mine.spec.id)).toBe(false);
  });

  it("a personal table left mid-hand plays on to the whistle, settles the ante, then closes", async () => {
    const { port, lobby } = await start();
    const p = await phone(port, tokenA);
    const id = (p.welcome.account as { id: string }).id;
    const listed = [...lobby.tables.values()].find((t) => t.spec.mode === "players")!;
    p.send({ type: "sit", tableId: listed.spec.id });
    const sat = await p.next((m) => m.type === "sat") as { tableId: string };
    const mine = lobby.tables.get(sat.tableId)!;
    lobby.advance(1.5);
    p.send({ type: "leave" });
    await p.next((m) => m.type === "lobby");
    expect(lobby.tables.has(mine.spec.id)).toBe(true);
    untilSettled(lobby, mine);
    expect(lobby.tables.has(mine.spec.id)).toBe(false);
    expect(lobby.store.history(id)).toHaveLength(1);
    expect(lobby.store.ledgerTotal(id)).toBe(lobby.store.balance(id));
  });

  it("runs a free quarter contest: same cards for everyone, prizes from the sponsor", async () => {
    const { port, lobby } = await start();
    const a = await phone(port, tokenA);
    const b = await phone(port, tokenB);
    const ids = [a, b].map((p) => (p.welcome.account as { id: string }).id);
    const listed = (a.welcome.tables as { id: string; contest: { name: string; entry: { kind: string } } }[]).find((t) => t.contest.name === "Free quarter contest")!;
    expect(listed.contest.entry.kind).toBe("free");
    const table = lobby.tables.get(listed.id)!;
    for (const p of [a, b]) {
      p.send({ type: "sit", tableId: listed.id });
      expect(await p.next((m) => m.type === "sat")).toMatchObject({ tableId: listed.id, status: "seated" });
    }

    quarter(lobby, 6);
    expect(table.humans).toEqual(ids);
    for (const id of ids) expect(lobby.store.balance(id)).toBe(1000); // free: no ante
    const mine = (id: string) => table.view(id).hand!.mine!.cards.map((c) => c.playerId);
    expect(mine(ids[1]!)).toEqual(mine(ids[0]!));
    expect(table.view(ids[0]!).hand!.others.every((o) => !o.bot && !o.dealer)).toBe(true);

    a.send({ type: "hit" });
    await a.next((m) => m.type === "table" && (m.hand as { mine?: { cards: unknown[] } } | null)?.mine?.cards.length === 3);
    untilSettled(lobby, table);

    const result = table.view(ids[0]!).result!;
    const paid = ids.map((id) => lobby.store.balance(id) - 1000);
    expect(paid.reduce((x, y) => x + y, 0)).toBe(-lobby.store.ledger.balance("sponsor:sportsjack"));
    for (const [i, id] of ids.entries()) {
      expect(result.standings.find((s) => s.you === (i === 0))!.payout).toBe(paid[i]);
      expect(lobby.store.history(id)).toHaveLength(1);
    }
    expect(paid.every((x) => [0, 500, 250, 375, 100].includes(x))).toBe(true);
    expect(lobby.store.audit()).toMatchObject({ ok: true, totals: { chips: 0 } });
  });

  it("refuses a seat at a full table", async () => {
    const { port, lobby } = await start();
    const listed = [...lobby.tables.values()].find((t) => t.spec.contest.name === "Free quarter contest")!;
    listed.spec.contest = { ...listed.spec.contest, seats: 1 };
    const a = await phone(port, tokenA);
    const b = await phone(port, tokenB);
    a.send({ type: "sit", tableId: listed.spec.id });
    await a.next((m) => m.type === "sat");
    b.send({ type: "sit", tableId: listed.spec.id });
    expect(await b.next((m) => m.type === "error")).toMatchObject({ reason: "table_full" });
    expect(listed.seated.size).toBe(1);
  });

  it("assigns variant switches, records them on hands and reports retention by variant", async () => {
    const { port, lobby } = await start({ variants: "variation=B;rewards=off", adminToken: "s3cret" });
    const p = await phone(port, tokenA);
    expect(p.welcome.variants).toEqual({ variation: "B", rewards: "off" });
    const id = (p.welcome.account as { id: string }).id;
    const table = [...lobby.tables.values()].find((t) => t.spec.mode === "dealer" && t.spec.ante === 25)!;
    p.send({ type: "sit", tableId: table.spec.id });
    await p.next((m) => m.type === "sat");
    quarter(lobby, 6);
    untilSettled(lobby, table);
    const summary = lobby.store.testSummary();
    expect(summary.byVariant.variation!.B).toMatchObject({ players: 1, realHands: 1 });
    expect(summary.byVariant.variation!.A).toMatchObject({ players: 0, realHands: 0 });
    const sit = lobby.store.eventRows().find((e) => e.name === "sit")!;
    expect(JSON.parse(String(sit.props)).variants).toEqual({ variation: "B", rewards: "off" });

    const admin = `http://localhost:${port}/api/admin/variants?key=s3cret`;
    expect(await (await fetch(admin)).json()).toMatchObject({ weights: { variation: { B: 1 }, rewards: { off: 1 } }, players: { variation: { B: 1 }, rewards: { off: 1 } }, tables: { free_contest_deal: "shared" } });
    const moved = await fetch(admin, { method: "POST", body: JSON.stringify({ accountId: id, switch: "variation", value: "C" }) });
    expect(await moved.json()).toEqual({ ok: true, variants: { variation: "C", rewards: "off" } });
    expect((await fetch(admin, { method: "POST", body: JSON.stringify({ accountId: id, switch: "variation", value: "Q" }) })).status).toBe(400);
    expect((await fetch(`http://localhost:${port}/api/admin/variants`)).status).toBe(404);
  });

  it("deals the free contest by the free_contest_deal switch", async () => {
    const { lobby } = await start({ variants: "free_contest_deal=own;rewards=off" });
    const pool = [...lobby.tables.values()].find((t) => t.spec.contest.name === "Free quarter contest")!;
    expect(pool.spec.contest.deal).toBe("own");
  });

  it("refuses to start with a mistyped switch", async () => {
    await expect(start({ variants: "variaton=B" })).rejects.toThrow(/unknown switch/);
  });

  it("follows an invite link: the friend's code on connect, both paid after the first hand", async () => {
    const { port, lobby } = await start({ variants: "", adminToken: "s3cret" });
    const inviter = await phone(port, tokenA);
    const code = (inviter.welcome.perks as { referral: { code: string } }).referral.code;
    const socket = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((r) => socket.once("open", r));
    const welcome = new Promise<Record<string, unknown>>((r) => socket.on("message", (raw) => { const m = JSON.parse(String(raw)); if (m.type === "welcome") r(m); }));
    socket.send(JSON.stringify({ type: "hello", token: tokenB, ref: code }));
    const friendId = ((await welcome).account as { id: string }).id;
    const table = [...lobby.tables.values()].find((t) => t.spec.mode === "dealer" && t.spec.ante === 25)!;
    socket.send(JSON.stringify({ type: "sit", tableId: table.spec.id }));
    for (let i = 0; i < 20 && !table.seated.has(friendId); i++) await new Promise((r) => setTimeout(r, 10));
    quarter(lobby, 6);
    untilSettled(lobby, table);
    const result = table.view(friendId).result!;
    expect(result.rewards.map((r) => [r.kind, r.chips])).toEqual([["referral", 500], ["milestone", 100]]);
    const inviterId = (inviter.welcome.account as { id: string }).id;
    expect(lobby.store.balance(inviterId)).toBe(1500);
    expect(lobby.store.audit().ok).toBe(true);
    socket.close();

    const codes = `http://localhost:${port}/api/admin/codes?key=s3cret`;
    expect(await (await fetch(codes, { method: "POST", body: JSON.stringify({ code: "gianni", creator: "Gianni" }) })).json()).toEqual({ ok: true, code: "GIANNI" });
    expect(await (await fetch(codes)).json()).toEqual({ codes: [{ code: "GIANNI", creator: "Gianni", joined: 0, played: 0 }] });
  });
});
