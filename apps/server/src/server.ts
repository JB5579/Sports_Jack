import { execFileSync } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { ALPHA_RULES } from "@sportsjack/engine";
import { WebSocketServer, type WebSocket } from "ws";
import type { ServerConfig } from "./config.ts";
import { Lobby } from "./lobby.ts";
import { ActionError, type Table } from "./table.ts";

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };

interface Client { socket: WebSocket; accountId: string | null; tableId: string | null }

export interface SportsJackServer {
  http: Server;
  lobby: Lobby;
  listen(): Promise<number>;
  close(): Promise<void>;
}

function buildId(config: ServerConfig): string {
  if (config.candidate) return config.candidate;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "unknown"; }
}

export function createSportsJackServer(config: ServerConfig): SportsJackServer {
  const clients = new Set<Client>();
  const dirty = new Set<string>();
  let lobbyDirty = true;
  const lobby = new Lobby(config, (table) => { if (table) dirty.add(table.spec.id); else lobbyDirty = true; });
  const identity = buildId(config);

  const send = (socket: WebSocket, message: unknown) => { if (socket.readyState === 1) socket.send(JSON.stringify(message)); };
  const sendTable = (c: Client) => {
    const table = c.tableId ? lobby.tables.get(c.tableId) : undefined;
    if (table) send(c.socket, { type: "table", ...table.view(c.accountId), balance: c.accountId ? lobby.store.balance(c.accountId) : null });
  };
  /** Push changed tables to the players watching them, at most every 200 ms. */
  const flush = () => {
    for (const c of clients) {
      if (c.tableId && dirty.has(c.tableId)) sendTable(c);
      if (lobbyDirty && !c.tableId) send(c.socket, { type: "lobby", ...lobby.summary() });
    }
    dirty.clear();
    lobbyDirty = false;
  };

  const http = createServer((req, res) => route(req, res).catch((error) => {
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String(error) }));
  }));

  const json = (res: ServerResponse, status: number, body: unknown): void =>
    void res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));

  /** A JSON request body, at most 16 KB. */
  const body = (req: IncomingMessage) => new Promise<Record<string, unknown>>((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => { raw += chunk; if (raw.length > 16_384) { reject(new Error("body too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("bad json")); } });
  });
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const isAdmin = (req: IncomingMessage, url: URL) => {
    if (!config.adminToken) return false;
    const given = Buffer.from((req.headers.authorization ?? "").replace(/^Bearer /, "") || url.searchParams.get("key") || "");
    const want = Buffer.from(config.adminToken);
    return given.length === want.length && timingSafeEqual(given, want);
  };
  const csv = (rows: Record<string, unknown>[]) => {
    const cols = rows.length ? Object.keys(rows[0]!) : [];
    const cell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
  };

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "POST" && (url.pathname === "/api/feedback" || url.pathname === "/api/events")) {
      const b = await body(req).catch(() => null);
      const token = b && typeof b.token === "string" && b.token.length >= 16 ? b.token : null;
      if (!b || !token) return json(res, 400, { error: "send JSON with your device token" });
      const account = lobby.store.account(token);
      if (url.pathname === "/api/feedback") {
        const rating = Number.isInteger(b.rating) && (b.rating as number) >= 1 && (b.rating as number) <= 5 ? b.rating as number : null;
        const note = text(b.note, 2000);
        if (rating === null && !note) return json(res, 400, { error: "send a rating from 1 to 5 or a note" });
        lobby.store.addFeedback(account.id, { rating, note, name: text(b.name, 80), screen: text(b.screen, 40) || "unknown",
          handId: text(b.handId, 80) || null, gameId: text(b.gameId, 40) || null });
        return json(res, 200, { ok: true });
      }
      const events = Array.isArray(b.events) ? b.events.slice(0, 50) : [];
      lobby.store.addEvents(account.id, events.filter((e): e is { name: string; props?: Record<string, unknown> } =>
        !!e && typeof e === "object" && typeof (e as { name?: unknown }).name === "string")
        .map((e) => ({ name: text(e.name, 40), props: e.props && typeof e.props === "object" ? e.props : {} })));
      return json(res, 200, { ok: true });
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (!isAdmin(req, url)) return json(res, 404, { error: "not found" });
      if (url.pathname === "/api/admin/summary") return json(res, 200, lobby.store.testSummary());
      const rows = url.pathname === "/api/admin/feedback.csv" ? lobby.store.feedbackRows() : url.pathname === "/api/admin/events.csv" ? lobby.store.eventRows() : null;
      if (!rows) return json(res, 404, { error: "not found" });
      return void res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" }).end(csv(rows));
    }
    if (url.pathname === "/health") return json(res, 200, { status: "ok" });
    if (url.pathname === "/build-id") return void res.writeHead(200, { "content-type": "text/plain" }).end(identity);
    if (url.pathname === "/api/rules") return json(res, 200, { ...ALPHA_RULES, lockouts: [0, 30, 60, 120], antes: [25, 100, 1000] });
    if (url.pathname === "/api/lobby") return json(res, 200, lobby.summary());
    if (url.pathname === "/api/history") {
      const token = url.searchParams.get("token");
      if (!token) return json(res, 400, { error: "token required" });
      const account = lobby.store.account(token);
      return json(res, 200, { account, hands: lobby.store.history(account.id) });
    }
    if (config.testControls && req.method === "POST" && url.pathname.startsWith("/test/replay/")) {
      const runner = lobby.runners.get(url.searchParams.get("game") ?? "");
      if (!runner) return json(res, 404, { error: "unknown game" });
      runner.paused = url.pathname.endsWith("/pause");
      for (const t of lobby.tables.values()) if (t.spec.gameId === runner.game.gameId) dirty.add(t.spec.id);
      lobbyDirty = true;
      return json(res, 200, runner.status());
    }
    return serveStatic(url.pathname, res);
  }

  function serveStatic(pathname: string, res: ServerResponse): void {
    const root = config.webRoot;
    const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, safe);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
    if (!existsSync(file)) {
      res.writeHead(200, { "content-type": "text/plain" }).end("SportsJack server is running. Build the web app with npm run build:web.");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  }

  const wss = new WebSocketServer({ server: http, path: "/ws" });
  wss.on("connection", (socket) => {
    const client: Client = { socket, accountId: null, tableId: null };
    clients.add(client);
    socket.on("close", () => {
      clients.delete(client);
      if (client.tableId && lobby.tables.get(client.tableId)?.spec.practice) lobby.dispose(client.tableId);
    });
    socket.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(String(raw)); } catch { return send(socket, { type: "error", reason: "bad_json" }); }
      try { handle(client, msg); } catch (error) {
        send(socket, { type: "error", reason: error instanceof ActionError ? error.reason : error instanceof Error ? error.message : "error" });
      }
    });
  });

  /** Log a gameplay event for this tester, server side, so it can't be lost on the phone. */
  const log = (c: Client, name: string, props: Record<string, unknown> = {}) => { if (c.accountId) lobby.store.addEvents(c.accountId, [{ name, props }]); };

  function handle(c: Client, msg: Record<string, unknown>): void {
    if (msg.type === "hello") {
      const token = String(msg.token ?? "");
      if (token.length < 16) throw new Error("token_too_short");
      const account = lobby.store.account(token);
      c.accountId = account.id;
      // Reconnect: return to the table where this account is seated or in a hand.
      const table = [...lobby.tables.values()].find((t) => !t.spec.practice && (t.seated.has(account.id) || t.pending.has(account.id) || t.humans.includes(account.id)));
      c.tableId = table?.spec.id ?? null;
      send(c.socket, { type: "welcome", account: { id: account.id, balance: lobby.store.balance(account.id) }, rules: ALPHA_RULES, ...lobby.summary() });
      if (table) sendTable(c);
      return;
    }
    if (!c.accountId) throw new Error("say_hello_first");
    const table = (id: unknown): Table => {
      const t = lobby.tables.get(String(id ?? c.tableId));
      if (!t) throw new Error("unknown_table");
      return t;
    };
    switch (msg.type) {
      case "open": {
        const t = lobby.open({ gameId: String(msg.gameId), mode: msg.mode as "dealer", ante: Number(msg.ante), lockout: Number(msg.lockout), level: msg.level as "easy" }, c.accountId);
        msg = { type: "sit", tableId: t.spec.id };
        lobbyDirty = true;
      }
      // falls through: whoever opens a table sits at it
      case "sit": {
        const listed = table(msg.tableId);
        // Player tables deal at once on the player's own replay (MISSION.md, 2026-11-08).
        const t = listed.spec.mode === "players" && !listed.spec.personal ? lobby.personal(c.accountId, listed) : listed;
        if (c.tableId && c.tableId !== t.spec.id) lobby.tables.get(c.tableId)?.leave(c.accountId);
        const status = t.sit(c.accountId);
        c.tableId = t.spec.id;
        log(c, "sit", { tableId: t.spec.id, gameId: t.spec.gameId, mode: t.spec.mode, ante: t.spec.ante, lockout: t.spec.lockout, status, opened: msg.type === "open" });
        send(c.socket, { type: "sat", tableId: t.spec.id, status });
        sendTable(c);
        lobbyDirty = true;
        return;
      }
      case "practice": {
        if (c.tableId) lobby.tables.get(c.tableId)?.leave(c.accountId);
        const t = lobby.practice(c.accountId, msg.sport === "nba" ? "nba" : "nfl");
        c.tableId = t.spec.id;
        log(c, "practice_start", { tableId: t.spec.id, gameId: t.spec.gameId, sport: msg.sport === "nba" ? "nba" : "nfl" });
        send(c.socket, { type: "sat", tableId: t.spec.id, status: "seated" });
        sendTable(c);
        return;
      }
      case "leave": {
        const leaving = c.tableId ? lobby.tables.get(c.tableId) : undefined;
        const midHand = !!leaving?.hand && !leaving.hand.over && leaving.humans.includes(c.accountId);
        if (leaving) log(c, "leave", { tableId: leaving.spec.id, practice: !!leaving.spec.practice, personal: !!leaving.spec.personal, midHand });
        leaving?.leave(c.accountId);
        // A personal table mid-hand plays on to the whistle (the ante is in), then closes itself.
        if (leaving?.spec.practice || (leaving?.spec.personal && !midHand)) lobby.dispose(leaving.spec.id);
        c.tableId = null;
        send(c.socket, { type: "lobby", ...lobby.summary(), balance: lobby.store.balance(c.accountId) });
        return;
      }
      case "hit": case "freeze": case "burn": {
        const t = table(c.tableId);
        t.act(c.accountId, msg.type === "burn" ? { type: "burn", playerId: String(msg.playerId) } : { type: msg.type });
        log(c, msg.type, { tableId: t.spec.id, practice: !!t.spec.practice, clock: t.hand?.clock, total: t.hand?.total(c.accountId) });
        sendTable(c);
        return;
      }
      default:
        throw new Error("unknown_message");
    }
  }

  let timer: NodeJS.Timeout | null = null;
  const flusher = setInterval(flush, 200);
  if (config.clock === "real") {
    let last = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      lobby.advance(Math.min(1, (now - last) / 1000));
      last = now;
    }, 100);
  }

  return {
    http,
    lobby,
    listen: () => new Promise((resolve) => http.listen(config.port, () => {
      const address = http.address();
      resolve(typeof address === "object" && address ? address.port : config.port);
    })),
    close: () => new Promise((resolve) => {
      if (timer) clearInterval(timer);
      clearInterval(flusher);
      for (const c of clients) c.socket.terminate();
      wss.close();
      http.close(() => { lobby.store.close(); resolve(); });
    }),
  };
}
