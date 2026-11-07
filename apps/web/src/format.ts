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

export const qName = (q: number) => (q === 5 ? "OT" : `Q${q}`);

export function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]![0]}. ${parts.slice(1).join(" ")}` : name;
}

const GROUP: Record<string, string> = { QB: "qb", RB: "rb", FB: "rb", WR: "wr", TE: "te", K: "st", P: "st", LS: "st" };
export const posColor = (position: string) => `var(--pos-${GROUP[position] ?? "def"})`;

/** "6 rec, 82 yds, 1 TD · 2 tackles": what a player did this quarter. */
export function statLine(st: StatDelta): string {
  const out: string[] = [];
  const n = (v: number | undefined) => v ?? 0;
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
