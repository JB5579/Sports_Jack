import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRules } from "@sportsjack/engine";
import type { LobbySummary } from "../../server/src/lobby.ts";
import type { TableView } from "../../server/src/table.ts";

export type { CardView, TableView } from "../../server/src/table.ts";
export type { LobbySummary } from "../../server/src/lobby.ts";
export type HistoryRow = { id: string; gameId: string; qtr: number; seed: number; commitment: string; total: number; ante: number; payout: number; net: number; at: string };

export interface OpenTableRequest { gameId: string; mode: "dealer" | "players"; ante: number; lockout: number; level: "easy" | "sharp" }

/**
 * This phone's play-money identity. Sign-up is still undecided (MISSION.md), so the
 * account is a random device token kept in this browser.
 */
export function deviceToken(): string {
  const make = () => `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  try {
    const saved = localStorage.getItem("sj-device");
    if (saved) return saved;
    const token = make();
    localStorage.setItem("sj-device", token);
    return token;
  } catch {
    return make();
  }
}

export interface Connection {
  status: "connecting" | "live" | "offline";
  accountId: string | null;
  balance: number | null;
  rules: GameRules | null;
  lobby: LobbySummary | null;
  table: (TableView & { balance: number | null }) | null;
  error: { reason: string; at: number } | null;
}

/** One WebSocket to the game server, reconnecting with backoff. The server holds all state. */
export function useSportsJack() {
  const [state, setState] = useState<Connection>({ status: "connecting", accountId: null, balance: null, rules: null, lobby: null, table: null, error: null });
  const socket = useRef<WebSocket | null>(null);
  const token = useRef(deviceToken());

  useEffect(() => {
    let closed = false;
    let retry = 500;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      socket.current = ws;
      ws.onopen = () => { retry = 500; ws.send(JSON.stringify({ type: "hello", token: token.current })); };
      ws.onmessage = (event) => {
        const m = JSON.parse(String(event.data));
        setState((s) => {
          switch (m.type) {
            case "welcome": return { ...s, status: "live", accountId: m.account.id, balance: m.account.balance, rules: m.rules, lobby: { games: m.games, tables: m.tables }, table: null };
            case "lobby": return { ...s, lobby: { games: m.games, tables: m.tables }, table: null, balance: m.balance ?? s.balance };
            case "table": return { ...s, table: m, balance: m.balance ?? s.balance };
            case "error": return { ...s, error: { reason: m.reason, at: Date.now() } };
            default: return s;
          }
        });
      };
      ws.onclose = () => {
        if (closed) return;
        setState((s) => ({ ...s, status: "offline" }));
        timer = setTimeout(connect, retry);
        retry = Math.min(retry * 2, 5000);
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); socket.current?.close(); };
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  }, []);

  return {
    state,
    token: token.current,
    sit: (tableId: string) => send({ type: "sit", tableId }),
    practice: (sport: "nfl" | "nba") => send({ type: "practice", sport }),
    open: (request: OpenTableRequest) => send({ type: "open", ...request }),
    leave: () => send({ type: "leave" }),
    hit: () => send({ type: "hit" }),
    freeze: () => send({ type: "freeze" }),
    burn: (playerId: string) => send({ type: "burn", playerId }),
    clearError: () => setState((s) => ({ ...s, error: null })),
  };
}

/** Whether this phone has been offered the practice hand. */
export const onboarding = {
  done(): boolean { try { return localStorage.getItem("sj-onboarded") === "1"; } catch { return true; } },
  finish(): void { try { localStorage.setItem("sj-onboarded", "1"); } catch { /* storage blocked */ } },
};

/** Usage events for the test round, sent in batches and when the app goes to the background. */
const queue: { name: string; props: Record<string, unknown> }[] = [];
function flushEvents(): void {
  if (!queue.length) return;
  const payload = JSON.stringify({ token: deviceToken(), events: queue.splice(0, 50) });
  try {
    if (!navigator.sendBeacon?.("/api/events", new Blob([payload], { type: "application/json" }))) throw new Error("no beacon");
  } catch {
    void fetch("/api/events", { method: "POST", body: payload, keepalive: true }).catch(() => undefined);
  }
}
setInterval(flushEvents, 5000);
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushEvents(); });

export function track(name: string, props: Record<string, unknown> = {}): void {
  queue.push({ name, props });
  if (queue.length >= 20) flushEvents();
}

export interface FeedbackInput { rating: number | null; note: string; name: string; screen: string; handId?: string | null; gameId?: string | null }

export async function sendFeedback(input: FeedbackInput): Promise<void> {
  const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: deviceToken(), ...input }) });
  if (!res.ok) throw new Error(`feedback ${res.status}`);
}

export async function fetchHistory(token: string): Promise<{ account: { id: string; balance: number }; hands: HistoryRow[] }> {
  const res = await fetch(`/api/history?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`history ${res.status}`);
  return res.json();
}
