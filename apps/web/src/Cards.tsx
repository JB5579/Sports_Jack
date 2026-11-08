import type { CardView } from "./api.ts";
import { clockText, fmt1, playText, posColor, shortName, statLine, weightText } from "./format.ts";

/** The 21-dial: a gauge to 21 with ticks at 17, 19 and 21. */
export function Dial({ total, frozen }: { total: number; frozen: boolean }) {
  const bust = total > 21, sweet = total >= 17 && total <= 21;
  const r = 98, cx = 130, cy = 118, circ = Math.PI * r;
  const pct = Math.max(0, Math.min(1, total / 21));
  const ring = frozen ? "var(--ice)" : bust ? "var(--down)" : sweet ? "var(--gold)" : "var(--felt-500)";
  const color = frozen ? "var(--ice)" : bust ? "var(--down)" : sweet ? "var(--gold-shine)" : "var(--on-felt)";
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div className="dial">
      <svg viewBox="0 0 260 136" aria-hidden="true">
        <path d={arc} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" strokeLinecap="round" />
        <path d={arc} fill="none" stroke={ring} strokeWidth="11" strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)} style={{ transition: "stroke-dashoffset .7s ease, stroke .3s" }} />
        {[17, 19, 21].map((v) => {
          const a = Math.PI - (Math.PI * v) / 21;
          const at = (rad: number) => [cx + Math.cos(a) * rad, cy - Math.sin(a) * rad] as const;
          const [x1, y1] = at(r - 11), [x2, y2] = at(r + 9), [tx, ty] = at(r + 20);
          return (
            <g key={v}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
              <text x={tx} y={ty + 3} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(255,255,255,0.45)">{v}</text>
            </g>
          );
        })}
      </svg>
      <div className="center">
        <div className="total num" style={{ color }}>{fmt1(total)}</div>
        <div className="sub">{bust ? `${fmt1(total - 21)} OVER` : `${fmt1(21 - total)} TO 21`}</div>
      </div>
    </div>
  );
}

export interface Flash { delta: number; until: number }

export function PlayingCard({ card, flash, fresh, burnable, onClick, mini = false }: {
  card: CardView; flash?: Flash | undefined; fresh: boolean; burnable: boolean; onClick: () => void; mini?: boolean;
}) {
  const live = card.value - card.face;
  const cls = ["pcard", mini && "mini", fresh && "fresh", flash && (flash.delta >= 0 ? "flash-up" : "flash-down"), burnable && "burnable"].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={`${card.name}, ${fmt1(card.value)}`}>
      <span className="band" style={{ background: posColor(card.position) }} />
      {flash && <span className={`delta ${flash.delta >= 0 ? "up" : "down"}`}>{flash.delta >= 0 ? "▲" : "▼"}{fmt1(Math.abs(flash.delta))}</span>}
      <span className="pos">{card.position} · {card.team}</span>
      {!!card.sharedWith && <span className="shared" title={`Also face up in ${card.sharedWith} other hand${card.sharedWith === 1 ? "" : "s"}`}>×{card.sharedWith + 1}</span>}
      <span className="nm">{shortName(card.name)}</span>
      <span className="val num">{fmt1(card.value)}</span>
      <span className="split num">{card.face} face {live >= 0 ? "+" : "−"} {fmt1(Math.abs(live))} live</span>
    </button>
  );
}

export function GridCard({ card, liveWeight }: { card: CardView; liveWeight: number }) {
  return (
    <div className="gcard">
      <span className="band" style={{ background: posColor(card.position) }} />
      <div className="top"><span className="nm">{card.name}</span><span className="val num">{fmt1(card.value)}</span></div>
      <div className="math num">{card.position} · {card.team} · face {card.face} + {weightText(liveWeight)} × {fmt1(card.points)} pts</div>
      <div className="line">{statLine(card.stats)}</div>
      <div className="why">{card.why ? `${clockText(card.why.clock)}: ${playText(card.why.description)}` : `Projected ${card.projection.toFixed(1)} pts a quarter before this game.`}</div>
    </div>
  );
}
