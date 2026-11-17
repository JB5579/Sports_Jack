import type { PackState } from "./api.ts";
import { fmt1 } from "./format.ts";
import { Sheet } from "./Sheets.tsx";

const TIER_COLOR: Record<string, string> = {
  common: "var(--on-felt-dim)", uncommon: "var(--up)", rare: "var(--ice)", epic: "#c39bff", legendary: "var(--gold-shine)", grail: "var(--down)",
};

/** Variation C: hit for a pack between games, and the collection of player cards. */
export function PacksSheet({ packs, onStart, onHit, onStop, onSell, onClose }: {
  packs: PackState | null; onStart: () => void; onHit: () => void; onStop: () => void; onSell: (cardId: string) => void; onClose: () => void;
}) {
  if (!packs) return <Sheet label="Hit for a pack" onClose={onClose}><div className="waiting"><div className="big">Loading…</div></div></Sheet>;
  const run = packs.run;
  const live = run?.status === "live";
  const outcome = !run || live ? null
    : run.status === "won" ? `${run.pack}!` : run.status === "bust" ? "Over 21: no pack" : run.status === "short" ? `Stopped under ${packs.target}: no pack` : "Run refunded";
  return (
    <Sheet label="Hit for a pack" onClose={onClose}>
      <div className="sheet-head">
        <div><div className="label">Free · {packs.credits} of {packs.maxCredits} runs</div><h2>Hit for a pack</h2></div>
        <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <p className="help">Real players from the quarter that just finished, worth what they scored. Stop on {packs.target}–21 to win a pack of three player cards: {packs.packs.map((p) => `${p.from}+ ${p.name.replace(" pack", "")}`).join(", ")}. You earn a run every day and for every hand you play.</p>
      <div className="results packs-scroll">
        {run && (
          <div className="run">
            <div className="run-head"><span className="label">{run.edition}</span><strong className="num">{fmt1(run.total)}</strong></div>
            <div className="run-cards">{run.cards.map((c) => (
              <div key={c.playerId} className="run-card"><span className="nm">{c.name}</span><span className="label">{c.position} · {c.team}</span><span className="num">{fmt1(c.value)}</span></div>
            ))}</div>
            {outcome && <div className={`run-outcome${run.status === "won" ? " won" : ""}`}>{outcome}</div>}
            {run.opened.length > 0 && <div className="opened">{run.opened.map((c) => <Collectible key={c.id} card={c} />)}</div>}
          </div>
        )}
        {packs.collection.length > 0 && <div className="label" style={{ marginTop: 6 }}>Your collection · {packs.collection.length} {packs.collection.length === 1 ? "card" : "cards"}</div>}
        {packs.collection.map((c) => <Collectible key={c.id} card={c} onSell={() => onSell(c.id)} />)}
      </div>
      {live ? (
        <div className="pack-actions">
          <button className="secondary" type="button" onClick={onStop}>Stop at {fmt1(run!.total)}</button>
          <button className="primary" type="button" onClick={onHit}>Hit</button>
        </div>
      ) : (
        <button className="primary" type="button" disabled={packs.credits < 1} onClick={onStart}>{packs.credits < 1 ? "No runs left: play a hand to earn one" : "Start a run"}</button>
      )}
    </Sheet>
  );
}

function Collectible({ card, onSell }: { card: PackState["collection"][number]; onSell?: () => void }) {
  return (
    <div className="collectible" style={{ borderColor: TIER_COLOR[card.tier] }}>
      <div><div className="who">{card.name}</div><div className="note">{card.position} · {card.team} · {card.edition}</div></div>
      <span className="tier" style={{ color: TIER_COLOR[card.tier] }}>{card.tierName}</span>
      {onSell && <button type="button" className="sell" onClick={onSell}>Sell {card.chips.toLocaleString()}</button>}
    </div>
  );
}
