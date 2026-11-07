import { useEffect, useRef, useState } from "react";
import type { TableView } from "./api.ts";
import { Dial, PlayingCard, type Flash } from "./Cards.tsx";
import { clockText, fmt1, playText, qName, shortName } from "./format.ts";

export function TableScreen({ view, onLeave, onHit, onFreeze, onBurn, onGrid }: {
  view: TableView; onLeave: () => void; onHit: () => void; onFreeze: () => void; onBurn: (playerId: string) => void; onGrid: () => void;
}) {
  const { hand, game, table } = view;
  const mine = hand?.mine ?? null;
  const [burnPick, setBurnPick] = useState(false);
  const [flashes, setFlashes] = useState<Map<string, Flash>>(new Map());
  const previous = useRef(new Map<string, number>());
  const seen = useRef(new Set<string>());
  const handId = useRef<string | null>(null);

  // Flash a card when its value moves; mark newly drawn cards so only they animate in.
  useEffect(() => {
    if (!mine || !hand) return;
    if (handId.current !== hand.id) { handId.current = hand.id; previous.current.clear(); seen.current.clear(); }
    const now = Date.now();
    const next = new Map([...flashes].filter(([, f]) => f.until > now));
    for (const c of mine.cards) {
      const before = previous.current.get(c.playerId);
      if (before !== undefined && Math.abs(c.value - before) > 1e-6 && !mine.frozen) next.set(c.playerId, { delta: c.value - before, until: now + 2600 });
      previous.current.set(c.playerId, c.value);
    }
    if (next.size !== flashes.size || [...next.keys()].some((k) => !flashes.has(k))) setFlashes(next);
    const t = setTimeout(() => setFlashes((f) => new Map([...f].filter(([, x]) => x.until > Date.now()))), 2700);
    return () => clearTimeout(t);
  }, [mine, hand]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!mine?.canAct) setBurnPick(false); }, [mine?.canAct]);

  const fresh = (id: string) => { const isNew = !seen.current.has(id); seen.current.add(id); return isNew; };
  const vibrate = () => { try { navigator.vibrate?.(12); } catch { /* not supported */ } };

  const [, , away, home] = game.gameId.split("_");
  const header = (
    <div className="statusbar">
      <button className="icon-btn" type="button" aria-label="Leave table" onClick={onLeave}>←</button>
      <div className="score num"><span>{away}</span><b>{game.score.away}</b><span>–</span><b>{game.score.home}</b><span>{home}</span></div>
      <div style={{ textAlign: "right" }}>
        <div className="label">{game.phase === "quarter" ? qName(game.qtr) : "Break"} · {table.mode === "dealer" ? "vs dealer" : "players"}</div>
        <div className={`clock num${hand?.locked && !hand.over ? " locked" : ""}`}>{game.phase === "quarter" ? clockText(game.clock) : clockText(game.breakLeft)}</div>
      </div>
    </div>
  );

  if (!hand || !mine) {
    const next = game.nextQtr;
    return (
      <section className="screen">
        {header}
        {game.paused && <div className="banner">Live data paused. Hands hold until the feed is back.</div>}
        <div className="waiting">
          <span className="label">{table.mode === "dealer" ? `House dealer · ${table.level}` : "Player table"} · {table.ante} yd ante · {table.lockout ? `locks at ${clockText(table.lockout)}` : "no lockout"}</span>
          <div className="big">{view.you.joiningNextBreak || game.phase === "quarter" ? `You're in from ${next ? qName(next) : "the next quarter"}` : next ? `${qName(next)} deals soon` : "This game is over"}</div>
          {game.phase === "break" && next && <div className="count num">{clockText(game.breakLeft)}</div>}
          <p className="help">{game.phase === "quarter" ? "Players join between quarters, never during one. Watch this quarter play out; you'll be dealt in at the next break." : "Your ante comes out when the cards are dealt."}</p>
        </div>
      </section>
    );
  }

  const canAct = mine.canAct;
  const status = mine.frozen ? <span className="chip ice">❄ Frozen at {fmt1(mine.total)}</span>
    : hand.over ? <span className="chip">Whistle · settling</span>
    : hand.locked ? <span className="chip ice">Locked · cards still live</span>
    : mine.total > 21 ? <span className="chip red">Busted · {fmt1(mine.total - 21)} over, still live</span>
    : mine.total >= 17 ? <span className="chip gold">★ Sweet spot</span> : <span className="chip">Live · values moving</span>;

  return (
    <section className="screen">
      {header}
      {hand.paused && <div className="banner">Live data paused. Nothing settles until the feed is back.</div>}
      <div className="opponents">
        {hand.others.map((o, i) => (
          <div key={i} className="opp">
            <div className="who">{o.bot && <span className="bot">BOT</span>}{o.name}</div>
            <div className={`tot num${o.frozen ? " frozen" : o.total > 21 ? " bust" : ""}`}>{fmt1(o.total)}</div>
            <div className="act">{o.cards} cards{o.lastAct ? ` · ${o.lastAct}` : ""}</div>
          </div>
        ))}
      </div>
      <div className="dial-wrap"><Dial total={mine.total} frozen={mine.frozen} />{status}</div>
      <div>
        <div className="hand-head"><span className="label">Your hand · {mine.cards.length} cards</span><button className="text-btn" type="button" onClick={onGrid}>Expand ▴</button></div>
        <div className="hand">
          {mine.cards.map((c) => (
            <PlayingCard key={c.playerId} card={c} flash={flashes.get(c.playerId)} fresh={fresh(c.playerId)} burnable={burnPick}
              onClick={() => { if (burnPick && canAct) { setBurnPick(false); vibrate(); onBurn(c.playerId); } else onGrid(); }} />
          ))}
        </div>
      </div>
      <div className="ticker" aria-live="polite">
        {hand.plays.length === 0 && <div className="play">Waiting for the first snap of {qName(hand.qtr)}. Cards sit at face value until a player records a stat.</div>}
        {hand.plays.map((p) => {
          const big = p.changes.some((c) => Math.abs(c.points) >= 4);
          const mineMoves = p.changes.filter((c) => c.mine);
          return (
            <div key={p.seq} className={`play${big ? " big" : ""}`}>
              <span className="when">{qName(p.qtr)} {clockText(p.clock)}</span>{playText(p.description)}
              {mineMoves.length > 0 && <span className="mine">{mineMoves.map((c) => (
                <span key={c.playerId} style={{ color: c.points >= 0 ? "var(--up)" : "var(--down)", marginRight: 8 }}>
                  {shortName(c.name)} {c.points >= 0 ? "+" : "−"}{fmt1(Math.abs(c.points / 2))}
                </span>))}</span>}
            </div>
          );
        })}
      </div>
      <div className="notice">{burnPick ? "Tap the card you want to burn" : hand.locked && !mine.frozen && !hand.over ? `Moves locked with ${clockText(hand.lockout)} left` : ""}</div>
      <div className="rail">
        <button className="burn" type="button" disabled={!canAct || mine.burned} onClick={() => setBurnPick(!burnPick)}>{burnPick ? "Cancel" : "Burn"}<small>{mine.burned ? "used" : "1 left"}</small></button>
        <button className="freeze" type="button" disabled={!canAct} onClick={() => { setBurnPick(false); vibrate(); onFreeze(); }}>Freeze<small>{mine.frozen ? "used" : "lock total"}</small></button>
        <button className="hit" type="button" disabled={!canAct} onClick={() => { setBurnPick(false); vibrate(); onHit(); }}>Hit<small>draw a player</small></button>
      </div>
    </section>
  );
}
