import { useEffect, useRef, useState } from "react";
import type { TableView } from "./api.ts";
import { Dial, PlayingCard, type Flash } from "./Cards.tsx";
import { advance, coachText, following, type CoachStep } from "./coach.ts";
import { track } from "./api.ts";
import { DEALER_RULES, freezeWindow } from "@sportsjack/engine";
import { clockText, fmt1, playText, qName, shortName, versus, weightWords } from "./format.ts";

export function TableScreen({ view, onLeave, onHit, onFreeze, onBurn, onGrid, onFeedback }: {
  view: TableView; onLeave: () => void; onHit: () => void; onFreeze: () => void; onBurn: (playerId: string) => void; onGrid: () => void; onFeedback: () => void;
}) {
  const { hand, game, table } = view;
  const mine = hand?.mine ?? null;
  const [burnPick, setBurnPick] = useState(false);
  const [flashes, setFlashes] = useState<Map<string, Flash>>(new Map());
  const previous = useRef(new Map<string, number>());
  const seen = useRef(new Set<string>());
  const handId = useRef<string | null>(null);
  const [coach, setCoach] = useState<CoachStep>("cards");
  const dealt = useRef(2);
  useEffect(() => {
    if (!table.practice || !mine) return;
    if (coach === "cards") dealt.current = mine.cards.length;
    const next = advance(coach, mine, dealt.current);
    if (next !== coach) { track("coach_step", { from: coach, to: next, how: "did_it" }); setCoach(next); }
  }, [mine, coach, table.practice]);
  // Most cards are bench players or defenders who may not score for a while; don't wait on them.
  useEffect(() => {
    if (coach !== "live") return;
    const t = setTimeout(() => setCoach((c) => (c === "live" ? "hit" : c)), 12000);
    return () => clearTimeout(t);
  }, [coach]);

  // Flash a card when its value moves; mark newly drawn cards so only they animate in.
  // Keys are "me:<id>" and "dealer:<id>": the same player can sit in both hands.
  useEffect(() => {
    if (!mine || !hand) return;
    if (handId.current !== hand.id) { handId.current = hand.id; previous.current.clear(); seen.current.clear(); }
    const now = Date.now();
    const next = new Map([...flashes].filter(([, f]) => f.until > now));
    const watch: [string, number, boolean][] = [
      ...mine.cards.map((c) => [`me:${c.playerId}`, c.value, mine.frozen] as [string, number, boolean]),
      ...(hand.dealer?.cards ?? []).map((c) => [`dealer:${c.playerId}`, c.value, hand.dealer!.frozen] as [string, number, boolean]),
      ...(hand.dealer ? [] : hand.others.flatMap((o, i) => o.shown.map((c) => [`${i}:${c.playerId}`, c.value, o.frozen] as [string, number, boolean]))),
    ];
    for (const [key, value, frozen] of watch) {
      const before = previous.current.get(key);
      if (before !== undefined && Math.abs(value - before) > 1e-6 && !frozen) next.set(key, { delta: value - before, until: now + 2600 });
      previous.current.set(key, value);
    }
    if (next.size !== flashes.size || [...next.keys()].some((k) => !flashes.has(k))) setFlashes(next);
    const t = setTimeout(() => setFlashes((f) => new Map([...f].filter(([, x]) => x.until > Date.now()))), 2700);
    return () => clearTimeout(t);
  }, [mine, hand]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!mine?.canAct) setBurnPick(false); }, [mine?.canAct]);

  const fresh = (key: string) => { const isNew = !seen.current.has(key); seen.current.add(key); return isNew; };
  const vibrate = () => { try { navigator.vibrate?.(12); } catch { /* not supported */ } };

  const { away, home } = game;
  const header = (
    <div className="statusbar">
      <button className="icon-btn" type="button" aria-label="Leave table" onClick={onLeave}>←</button>
      <div className="score num"><span>{away}</span><b>{game.score.away}</b><span>–</span><b>{game.score.home}</b><span>{home}</span></div>
      <div style={{ textAlign: "right" }}>
        <div className="label">{game.phase === "quarter" ? qName(game.qtr) : "Break"} · {table.practice ? "practice" : table.mode === "dealer" ? "vs dealer" : "players"}</div>
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
          <span className="label">{table.mode === "dealer" ? `House dealer · ${table.level}` : "Player table"} · {table.ante}-chip ante · {table.lockout ? `locks at ${clockText(table.lockout)}` : "no lockout"}</span>
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
      {/* The score bar and the action rail stay put; everything between scrolls on short screens. */}
      <div className="table-body">
      {hand.dealer ? (
        <div className="dealer" aria-label="Dealer's hand">
          <div className="dealer-head">
            <span className="who">{hand.dealer.name}</span>
            <span className={`dealer-total num${hand.dealer.frozen ? " frozen" : hand.dealer.total > 21 ? " bust" : ""}`}>{fmt1(hand.dealer.total)}</span>
          </div>
          <div className="dealer-cards">
            {hand.dealer.cards.map((c) => (
              <PlayingCard key={c.playerId} card={c} mini flash={flashes.get(`dealer:${c.playerId}`)} fresh={fresh(`dealer:${c.playerId}`)} burnable={false} onClick={() => undefined} />
            ))}
          </div>
          <div className="dealer-rule">
            <b>{hand.dealer.frozen ? `Frozen at ${fmt1(hand.dealer.total)}` : hand.dealer.nextLook !== null ? `Next look ${clockText(hand.dealer.nextLook)}` : "Done for this quarter"}</b>
            {" · "}hits under {DEALER_RULES[hand.dealer.level].hitBelow} · freezes 17–21 from {clockText(freezeWindow(hand.dealer.level, hand.lockout))}
          </div>
        </div>
      ) : <div className="opponents rows" aria-label="Other hands">
        {hand.others.map((o, i) => (
          <div key={i} className="opp row">
            <div className="opp-head">
              <span className="who">{o.bot && <span className="bot">BOT</span>}{o.name}</span>
              <span className="act">{o.frozen ? "Frozen" : o.lastAct}</span>
              <span className={`tot num${o.frozen ? " frozen" : (o.total ?? o.shownTotal) > 21 ? " bust" : ""}`}>
                {o.total !== null ? fmt1(o.total) : `${fmt1(o.shownTotal)} + ?`}
              </span>
            </div>
            <div className="opp-cards">
              {o.shown.map((c) => (
                <PlayingCard key={c.playerId} card={c} mini flash={flashes.get(`${i}:${c.playerId}`)} fresh={fresh(`${i}:${c.playerId}`)} burnable={false} onClick={() => undefined} />
              ))}
              {Array.from({ length: o.hidden }, (_, k) => <span key={`hole-${k}`} className="pcard mini back" aria-label="Face-down card" />)}
            </div>
          </div>
        ))}
      </div>}
      <div className="dial-wrap compact"><Dial total={mine.total} frozen={mine.frozen} />{status}
        {hand.dealer && <div className="versus num">{versus(mine.total, hand.dealer.total)}</div>}</div>
      <div>
        <div className="hand-head"><span className="label">Your hand · {mine.cards.length} cards</span>
        <span className="status-line"><button className="text-btn" type="button" onClick={onFeedback}>Feedback</button><button className="text-btn" type="button" onClick={onGrid}>Expand ▴</button></span></div>
        <div className="hand">
          {mine.cards.map((c) => (
            <PlayingCard key={c.playerId} card={c} flash={flashes.get(`me:${c.playerId}`)} fresh={fresh(`me:${c.playerId}`)} burnable={burnPick}
              onClick={() => { if (burnPick && canAct) { setBurnPick(false); vibrate(); onBurn(c.playerId); } else onGrid(); }} />
          ))}
        </div>
      </div>
      <div className="ticker" aria-live="polite">
        {hand.plays.length === 0 && <div className="play">Waiting for the first snap of {qName(hand.qtr)}. Cards sit at face value until a player records a stat.</div>}
        {hand.plays.map((p) => {
          const big = p.changes.some((c) => Math.abs(c.points * hand.liveWeight) >= 2);
          const mineMoves = p.changes.filter((c) => c.mine);
          return (
            <div key={p.seq} className={`play${big ? " big" : ""}`}>
              <span className="when">{qName(p.qtr)} {clockText(p.clock)}</span>{playText(p.description)}
              {mineMoves.length > 0 && <span className="mine">{mineMoves.map((c) => (
                <span key={c.playerId} style={{ color: c.points >= 0 ? "var(--up)" : "var(--down)", marginRight: 8 }}>
                  {shortName(c.name)} {c.points >= 0 ? "+" : "−"}{fmt1(Math.abs(c.points * hand.liveWeight))}
                </span>))}</span>}
            </div>
          );
        })}
      </div>
      {table.practice && coach !== "done" && !hand.over && (() => {
        const text = coachText(coach, game.sport, weightWords(hand.liveWeight));
        return (
          <div className="coach" role="note">
            <div className="coach-title">{text.title}</div>
            <p>{text.body}</p>
            <button type="button" className="text-btn" onClick={() => { track("coach_step", { from: coach, to: following(coach), how: text.action, sport: game.sport }); setCoach(following(coach)); }}>
              {text.action === "next" ? "Next" : text.action === "skip" ? "Skip this step" : "Got it"}
            </button>
          </div>
        );
      })()}
      </div>
      <div className="notice">{burnPick ? "Tap the card you want to burn" : hand.locked && !mine.frozen && !hand.over ? `Moves locked with ${clockText(hand.lockout)} left` : ""}</div>
      <div className="rail">
        <button className={`burn${table.practice && coach === "burn" ? " coached" : ""}`} type="button" disabled={!canAct || mine.burned} onClick={() => setBurnPick(!burnPick)}>{burnPick ? "Cancel" : "Burn"}<small>{mine.burned ? "used" : "1 left"}</small></button>
        <button className={`freeze${table.practice && coach === "freeze" ? " coached" : ""}`} type="button" disabled={!canAct} onClick={() => { setBurnPick(false); vibrate(); onFreeze(); }}>Freeze<small>{mine.frozen ? "used" : "lock total"}</small></button>
        <button className={`hit${table.practice && coach === "hit" ? " coached" : ""}`} type="button" disabled={!canAct} onClick={() => { setBurnPick(false); vibrate(); onHit(); }}>Hit<small>draw a player</small></button>
      </div>
    </section>
  );
}
