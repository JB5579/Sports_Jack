import type { StatDelta } from "@sportsjack/feed";

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export function clockText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Play text without its leading clock and formation notes: "(10:44) (Shotgun) 10-D.Maye…" → "10-D.Maye…". */
export function playText(description: string): string {
  return description.replace(/^\(\s*\d*:\d+\)\s*/, "").replace(/\((Shotgun|No Huddle, Shotgun|No Huddle)\)\s*/g, "").replace(/\s+/g, " ").trim();
}

export const qName = (q: number) => (q === 5 ? "OT" : q > 5 ? `${q - 4}OT` : `Q${q}`);

/** A live weight as people say it: 0.5 → "½", 0.2 → "⅕". */
export const weightText = (w: number) => ({ 0.5: "½", 0.25: "¼", 0.2: "⅕" } as Record<number, string>)[w] ?? String(w);

/** The same share in words, for sentences: 0.5 → "half", 0.2 → "a fifth". */
export const weightWords = (w: number) => ({ 0.5: "half", 0.25: "a quarter", 0.2: "a fifth" } as Record<number, string>)[w] ?? `${w} ×`;

export function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]![0]}. ${parts.slice(1).join(" ")}` : name;
}

const GROUP: Record<string, string> = {
  QB: "qb", RB: "rb", FB: "rb", WR: "wr", TE: "te", K: "st", P: "st", LS: "st",
  // Basketball: guards, forwards, centers.
  G: "wr", PG: "wr", SG: "wr", F: "rb", SF: "rb", PF: "rb", C: "qb",
};
export const posColor = (position: string) => `var(--pos-${GROUP[position] ?? "def"})`;

/** "6 rec, 82 yds, 1 TD · 2 tackles" or "12 pts (2 threes) · 5 reb": what a player did this quarter. */
export function statLine(st: StatDelta): string {
  const out: string[] = [];
  const n = (v: number | undefined) => v ?? 0;
  if (st.pts) out.push(`${st.pts} pts${st.fg3m ? ` (${st.fg3m} three${st.fg3m === 1 ? "" : "s"})` : ""}`);
  if (st.reb) out.push(`${st.reb} reb`);
  if (st.ast) out.push(`${st.ast} ast`);
  if (st.stl) out.push(`${st.stl} stl`);
  if (st.blk) out.push(`${st.blk} blk`);
  if (st.tov) out.push(`${st.tov} turnover${st.tov === 1 ? "" : "s"}`);
  if (st.passYds || st.passTd || st.int) out.push(`${n(st.passYds)} pass yds${st.passTd ? `, ${st.passTd} TD` : ""}${st.int ? `, ${st.int} INT` : ""}`);
  if (st.rushYds || st.rushTd) out.push(`${n(st.rushYds)} rush yds${st.rushTd ? `, ${st.rushTd} TD` : ""}`);
  if (st.rec || st.recYds || st.recTd) out.push(`${n(st.rec)} rec, ${n(st.recYds)} yds${st.recTd ? `, ${st.recTd} TD` : ""}`);
  const tackles = n(st.soloTkl) + n(st.astTkl);
  if (tackles) out.push(`${tackles} tackle${tackles === 1 ? "" : "s"}`);
  if (st.sack) out.push(`${st.sack} sack${st.sack === 1 ? "" : "s"}`);
  if (st.defInt) out.push(`${st.defInt} INT`);
  if (st.ff) out.push(`${st.ff} forced fumble${st.ff === 1 ? "" : "s"}`);
  if (st.pd) out.push(`${st.pd} pass${st.pd === 1 ? "" : "es"} defended`);
  if (st.defTd) out.push("defensive TD");
  if (st.retTd) out.push("return TD");
  if (st.twoPt) out.push("2-pt conversion");
  if (st.sacked) out.push(`sacked ${st.sacked}×`);
  if (st.fumLost) out.push(`${st.fumLost} fumble lost`);
  return out.join(" · ") || "No stats yet this quarter";
}

const REFUSALS: Record<string, string> = {
  locked: "Moves are locked for the rest of this quarter.",
  frozen: "Your hand is frozen. It settles at the whistle.",
  burn_used: "You've already used your Burn this hand.",
  settled: "That hand has settled.",
  not_in_hand: "You're not in this hand. You'll be dealt in at the next quarter.",
  bad_ante: "Pick a 25, 100 or 1,000-yard ante.",
  bad_lockout: "Pick a lockout of none, 0:30, 1:00 or 2:00.",
};
export const refusalText = (reason: string) => REFUSALS[reason] ?? "That didn't work. Try again.";

/** Where you stand against the dealer, in the terms that decide the hand. */
export function versus(you: number, dealer: number): string {
  if (you > 21 && dealer > 21) return you < dealer ? `Both over 21 · you're closer, by ${fmt1(dealer - you)}` : you > dealer ? `Both over 21 · dealer's closer, by ${fmt1(you - dealer)}` : "Both over 21 · even";
  if (dealer > 21) return "Dealer is over 21 · stay at 21 or under to win";
  if (you > 21) return `You're over 21 · dealer has ${fmt1(dealer)}`;
  if (Math.abs(you - dealer) < 0.05) return "Even with the dealer";
  return you > dealer ? `You lead the dealer by ${fmt1(you - dealer)}` : `Dealer leads by ${fmt1(dealer - you)}`;
}
