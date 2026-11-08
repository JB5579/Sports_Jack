import { useState } from "react";
import type { LobbySummary, OpenTableRequest } from "./api.ts";
import { clockText, qName } from "./format.ts";

type Game = LobbySummary["games"][number];

function gameStatus(g: Game): { text: string; live: boolean } {
  const s = g.status;
  if (s.paused) return { text: "Live data paused", live: false };
  if (s.phase === "quarter") return { text: `${qName(s.qtr)} ${clockText(s.clock)}`, live: true };
  if (s.phase === "break" && s.nextQtr) return { text: `${qName(s.nextQtr)} deals in ${clockText(s.breakLeft)}`, live: false };
  return { text: "Final · replay restarts soon", live: false };
}

const lockoutText = (s: number) => (s === 0 ? "no lockout" : `locks at ${clockText(s)}`);

export function Lobby({ lobby, balance, onSit, onOpen, onWallet, onRules, onPractice, onFeedback }: {
  lobby: LobbySummary; balance: number | null; onSit: (tableId: string) => void; onOpen: (r: OpenTableRequest) => void;
  onWallet: () => void; onRules: () => void; onPractice: () => void; onFeedback: () => void;
}) {
  const [draft, setDraft] = useState<OpenTableRequest>({ gameId: lobby.games[0]?.gameId ?? "", mode: "dealer", ante: 25, lockout: 120, level: "easy" });
  const seg = <K extends keyof OpenTableRequest>(key: K, options: [OpenTableRequest[K], string][]) => (
    <div className="seg">{options.map(([v, label]) => (
      <button key={String(v)} type="button" aria-pressed={draft[key] === v} onClick={() => setDraft({ ...draft, [key]: v })}>{label}</button>
    ))}</div>
  );
  return (
    <section className="screen scroll">
      <header className="brand">
        <h1>Sports<em>Jack</em></h1>
        <button className="wallet-pill" type="button" onClick={onWallet}>
          <span className="label">Play-money yards</span>
          <strong className="num">{balance?.toLocaleString() ?? "—"}</strong>
        </button>
      </header>
      <p className="intro">Blackjack where every card is a real NFL player. A card is worth its face value plus half its live fantasy points this quarter. Get closest to 21 by the whistle. Real 2025 games, replayed play by play.</p>
      {lobby.games.map((g) => {
        const status = gameStatus(g);
        const tables = lobby.tables.filter((t) => t.gameId === g.gameId);
        return (
          <article key={g.gameId} className="game-card">
            <div className="matchup">
              <span className="team">{g.away}</span><span className="at">at</span><span className="team">{g.home}</span>
              <span className="meta">
                <span className={`chip${status.live ? " live" : ""}`}>{status.text}</span>
                <span className="label num">{g.status.score.away}–{g.status.score.home}</span>
              </span>
            </div>
            <div className="game-title">{g.label}</div>
            <div className="table-rows">
              {tables.map((t) => (
                <div key={t.id} className="trow">
                  <div>
                    <div className="what">{t.mode === "dealer" ? `House dealer · ${t.level === "sharp" ? "Sharp" : "Easy"}` : "Player table"}</div>
                    <div className="meta">{t.ante} yd ante · {lockoutText(t.lockout)} · {t.seated} seated</div>
                  </div>
                  <button type="button" onClick={() => onSit(t.id)}>Sit</button>
                </div>
              ))}
            </div>
          </article>
        );
      })}
      <details className="open-table">
        <summary>Open your own table</summary>
        <div className="setup">
          <div className="field"><label className="label" htmlFor="open-game">Game</label>
            <select id="open-game" className="select" value={draft.gameId} onChange={(e) => setDraft({ ...draft, gameId: e.target.value })}>
              {lobby.games.map((g) => <option key={g.gameId} value={g.gameId}>{g.label}</option>)}
            </select></div>
          <div className="field"><span className="label">Play against</span>{seg("mode", [["dealer", "House dealer"], ["players", "Players"]])}</div>
          <div className="field"><span className="label">{draft.mode === "dealer" ? "Dealer level" : "Bot level"}</span>{seg("level", [["easy", "Easy"], ["sharp", "Sharp"]])}</div>
          <div className="field"><span className="label">Ante (yards)</span>{seg("ante", [[25, "25"], [100, "100"], [1000, "1,000"]])}</div>
          <div className="field"><span className="label">Action lockout</span>{seg("lockout", [[0, "None"], [30, "0:30"], [60, "1:00"], [120, "2:00"]])}
            <p className="help">Hit, Burn and Freeze close with this much left in the quarter. Cards keep moving to the whistle. Fixed for the table's life.</p></div>
          <button className="primary" type="button" onClick={() => onOpen(draft)}>Open table and sit</button>
        </div>
      </details>
      <div className="status-line">
        <button className="text-btn" type="button" onClick={onPractice}>Play a free practice hand</button>
        <span className="label">·</span>
        <button className="text-btn" type="button" onClick={onRules}>How it works</button>
        <span className="label">·</span>
        <button className="text-btn" type="button" onClick={onFeedback}>Send feedback</button>
      </div>
      <p className="foot">Play money only. Plays from nflverse (CC-BY 4.0). Projections use only games before each matchup. Other seats at player tables are bots, and are labeled.</p>
    </section>
  );
}
