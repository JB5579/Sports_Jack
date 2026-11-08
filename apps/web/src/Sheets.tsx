import { useEffect, useState, type ReactNode } from "react";
import type { GameRules } from "@sportsjack/engine";
import { fetchHistory, sendFeedback, track, type HistoryRow, type TableView } from "./api.ts";
import { GridCard } from "./Cards.tsx";
import { clockText, fmt1, qName } from "./format.ts";

export function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="sheet-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

const Close = ({ onClose }: { onClose: () => void }) => (
  <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>✕</button>
);

export function GridSheet({ view, onClose }: { view: TableView; onClose: () => void }) {
  useEffect(() => { track("grid_open", { cards: view.hand?.mine?.cards.length }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hand = view.hand!;
  const mine = hand.mine!;
  return (
    <Sheet label="Your hand" onClose={onClose}>
      <div className="sheet-head">
        <div><div className="label">Your hand · {qName(hand.qtr)} {clockText(hand.clock)}</div><h2>{mine.cards.length} cards · {fmt1(mine.total)}</h2></div>
        <Close onClose={onClose} />
      </div>
      <div className="grid">{mine.cards.map((c) => <GridCard key={c.playerId} card={c} />)}</div>
    </Sheet>
  );
}

const RATINGS: [number, string][] = [[1, "Not for me"], [2, "Meh"], [3, "OK"], [4, "Fun"], [5, "Loved it"]];

/** One tap to rate the hand just played; the rating goes straight to the test-round feedback. */
function QuickRating({ handId, gameId, screen }: { handId: string; gameId: string; screen: string }) {
  const [sent, setSent] = useState<number | null>(null);
  if (sent !== null) return <p className="help" role="status">Thanks. You rated this hand {sent} of 5.</p>;
  return (
    <div className="field">
      <span className="label">How fun was that hand?</span>
      <div className="seg">{RATINGS.map(([n, label]) => (
        <button key={n} type="button" aria-label={`${n}, ${label}`} onClick={() => { setSent(n); void sendFeedback({ rating: n, note: "", name: "", screen, handId, gameId }).catch(() => setSent(null)); }}>{n}</button>
      ))}</div>
    </div>
  );
}

export function FeedbackSheet({ screen, gameId, onClose }: { screen: string; gameId: string | null; onClose: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [name, setName] = useState(() => { try { return localStorage.getItem("sj-name") ?? ""; } catch { return ""; } });
  const [state, setState] = useState<"editing" | "sending" | "sent" | "failed">("editing");
  const submit = async () => {
    setState("sending");
    try {
      try { localStorage.setItem("sj-name", name); } catch { /* storage blocked */ }
      await sendFeedback({ rating, note, name, screen, gameId });
      setState("sent");
    } catch { setState("failed"); }
  };
  return (
    <Sheet label="Send feedback" onClose={onClose}>
      <div className="sheet-head"><div><div className="label">Test round feedback</div><h2>{state === "sent" ? "Thank you" : "What do you think?"}</h2></div><Close onClose={onClose} /></div>
      {state === "sent" ? <>
        <p className="help">Got it. Every note gets read, and it shapes what SportsJack becomes.</p>
        <button className="primary" type="button" onClick={onClose}>Back to the game</button>
      </> : <>
        <div className="field"><span className="label">Overall, how fun is it?</span>
          <div className="seg">{RATINGS.map(([n, label]) => (
            <button key={n} type="button" aria-pressed={rating === n} aria-label={`${n}, ${label}`} onClick={() => setRating(n)}>{n}</button>
          ))}</div></div>
        <div className="field"><label className="label" htmlFor="fb-note">What worked? What was confusing or slow?</label>
          <textarea id="fb-note" className="select" rows={5} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} style={{ padding: 10, resize: "vertical" }} /></div>
        <div className="field"><label className="label" htmlFor="fb-name">Your name (optional)</label>
          <input id="fb-name" className="select" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
        {state === "failed" && <p className="help" role="alert">Couldn't send that. Check your connection and tap Send again.</p>}
        <button className="primary" type="button" disabled={state === "sending" || (rating === null && !note.trim())} onClick={() => void submit()}>
          {state === "sending" ? "Sending…" : "Send feedback"}</button>
      </>}
    </Sheet>
  );
}

export function ResultSheet({ view, balance, onNext, onLobby, onPracticeAgain }: {
  view: TableView; balance: number | null; onNext: () => void; onLobby: () => void; onPracticeAgain: () => void;
}) {
  const result = view.result!;
  const me = result.standings.find((s) => s.you);
  const net = me ? me.payout - view.table.ante : 0;
  const winners = result.standings.filter((s) => s.rank === 1);
  const iWin = winners.some((s) => s.you);
  // From the standings, not the payout: a practice hand has no ante, so payouts can't tell.
  const dealer = result.standings.find((s) => s.dealer);
  const outcome = !me ? "Hand settled" : view.table.mode === "dealer" && dealer
    ? (me.rank < dealer.rank ? "You win" : me.rank === dealer.rank ? "Push" : "You lose")
    : (iWin ? (winners.length > 1 ? "Split pot" : "You win") : "You lose");
  const { game } = view;
  if (view.table.practice) {
    return (
      <Sheet label="Practice hand result" onClose={onLobby}>
        <div className="sheet-head"><div><div className="label">Practice hand · no yards at stake</div><h2>{outcome}</h2></div></div>
        <div className="results">
          {result.standings.map((s, i) => (
            <div key={i} className={`res${s.you ? " me" : ""}`}>
              <span className="rk">{s.rank}</span>
              <div><div className="who">{s.name}</div><div className="note">{s.bust ? "busted" : "stayed under"}</div></div>
              <span className={`t num${s.bust ? " bust" : ""}`}>{fmt1(s.total)}</span>
            </div>
          ))}
        </div>
        <QuickRating handId={result.handId} gameId={view.table.gameId} screen="practice_result" />
        <p className="help">That's the whole game: one quarter, one hand. Real tables use play-money yards; you start with 1,000.</p>
        <button className="primary" type="button" onClick={onLobby}>Go to the tables</button>
        <button className="secondary" type="button" onClick={onPracticeAgain}>Practice again</button>
      </Sheet>
    );
  }
  return (
    <Sheet label="Hand result" onClose={onNext}>
      <div className="sheet-head"><div><div className="label">{qName(result.qtr)} whistle · score {game.score.away}–{game.score.home}</div><h2>{outcome}</h2></div></div>
      <div className="payout">
        <div className={`big num ${net > 0 ? "win" : net < 0 ? "loss" : ""}`}>{net > 0 ? "+" : net < 0 ? "−" : ""}{Math.abs(net)} yds</div>
        <div className="label">
          {view.table.mode === "dealer" ? "Even money against the dealer" : `Pot ${result.pot} · house ${result.house}`}
          {balance !== null && ` · balance ${balance.toLocaleString()}`}
        </div>
      </div>
      <div className="results">
        {result.standings.map((s, i) => (
          <div key={i} className={`res${s.you ? " me" : ""}`}>
            <span className="rk">{s.rank}</span>
            <div><div className="who">{s.bot && <span className="chip" style={{ padding: "1px 5px", marginRight: 4 }}>BOT</span>}{s.name}</div>
              <div className="note">{s.bust ? "busted" : "stayed under"}</div></div>
            <span className={`t num${s.bust ? " bust" : ""}`}>{fmt1(s.total)}</span>
          </div>
        ))}
      </div>
      <QuickRating handId={result.handId} gameId={view.table.gameId} screen="result" />
      <p className="help">Closest to 21 without going over wins. If everyone busts, the hand closest from above wins. Ties split. Seed {result.seed}, committed before the deal.</p>
      {game.nextQtr ? <button className="primary" type="button" onClick={onNext}>Stay for {qName(game.nextQtr)} · ante {view.table.ante}</button>
        : <p className="help">That was the last hand of this game.</p>}
      <button className="secondary" type="button" onClick={onLobby}>Back to lobby</button>
    </Sheet>
  );
}

export function WalletSheet({ token, balance, onClose }: { token: string; balance: number | null; onClose: () => void }) {
  const [hands, setHands] = useState<HistoryRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { track("wallet_open"); }, []);
  useEffect(() => { fetchHistory(token).then((h) => setHands(h.hands), () => setFailed(true)); }, [token]);
  return (
    <Sheet label="Wallet" onClose={onClose}>
      <div className="sheet-head"><div><div className="label">Play-money wallet</div><h2>{balance?.toLocaleString() ?? "—"} yards</h2></div><Close onClose={onClose} /></div>
      <div className="hist">
        {failed && <p className="help">Couldn't load your hands. Check your connection and open the wallet again.</p>}
        {hands && hands.length === 0 && <p className="help">No hands yet. Your settled hands show up here.</p>}
        {hands?.map((h) => (
          <div key={h.id} className="hrow">
            <span>{h.gameId.replace(/_/g, " ")} · {qName(h.qtr)} · finished {fmt1(h.total)}</span>
            <span className={`net num ${h.net > 0 ? "pos" : h.net < 0 ? "neg" : ""}`}>{h.net > 0 ? "+" : ""}{h.net}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function RulesSheet({ rules, onClose }: { rules: GameRules | null; onClose: () => void }) {
  useEffect(() => { track("rules_open"); }, []);
  const p = rules?.scoring.points;
  const rows: [string, string][] = p ? [
    ["Passing yard", String(p.passYds)], ["Rushing or receiving yard", String(p.rushYds)], ["Reception", String(p.rec)],
    ["Rushing, receiving or return TD", String(p.rushTd)], ["Passing TD", String(p.passTd)],
    ["Interception thrown, fumble lost", String(p.int)], ["Sacked", String(p.sacked)],
    ["Solo / assisted tackle", `${p.soloTkl} / ${p.astTkl}`], ["Sack", String(p.sack)],
    ["Interception, forced fumble", String(p.defInt)], ["Pass defended", String(p.pd)], ["Defensive TD", String(p.defTd)],
  ] : [];
  return (
    <Sheet label="Rules" onClose={onClose}>
      <div className="sheet-head"><div><div className="label">Rules · {rules?.id} · {rules?.scoring.id}</div><h2>How a hand works</h2></div><Close onClose={onClose} /></div>
      <div className="rules">
        <p>One quarter is one hand. Overtime is a bonus hand. You join between quarters, never during one.</p>
        <p>The deck is every player on both game-day rosters. Each card is worth its <b>face value</b> (2 to 10, from the player's projection before the game) plus <b>half its live fantasy points</b> this quarter.</p>
        <h3>Your moves</h3>
        <p><b>Hit</b> as often as you like. <b>Burn</b> once to swap a card for a new draw. <b>Freeze</b> once to lock your total. There is no Stand: an unfrozen hand keeps moving until the whistle. Moves close at the table's lockout time.</p>
        <h3>Points per play</h3>
        <table><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
        <h3>Winning</h3>
        <p>Closest to 21 without going over wins. Busting is live: a negative play can pull you back under. If everyone busts, the hand closest from above wins. Ties split. A win against the dealer pays even money; a tie returns your ante. Player tables take a {Math.round((rules?.rake ?? 0.1) * 100)}% rake.</p>
      </div>
    </Sheet>
  );
}
