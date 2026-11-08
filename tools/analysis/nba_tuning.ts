// NBA scoring tuning: which face scale and live weight land hands near 21 on real games?
//   uv run --with pyarrow tools/nba/fetch_fixtures.py --season-csv 2026
//   node --experimental-strip-types --max-old-space-size=4096 tools/analysis/nba_tuning.ts 2026 [k,...] [w,...] [targets]
// Results are in docs/analysis/NBA-tuning.md.
import { createReadStream, readFileSync } from "node:fs";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { nbaGameFromRows } from "../../packages/feed/src/index.ts";
import { NBA_V1, QuarterScorer, seededRandom } from "../../packages/engine/src/index.ts";

type Row = Record<string, string>;
const season = process.argv[2] ?? "2026";
const games = new Map<string, Row[]>();
for await (const row of createReadStream(`.cache/nba/play_by_play_${season}.csv`).pipe(parse({ columns: true })) as AsyncIterable<Row>) {
  const list = games.get(row.game_id!) ?? [];
  list.push(row);
  games.set(row.game_id!, list);
}

// The deck: everyone dressed (listed as a coach's decision, or who played).
const box = parseSync(readFileSync(`.cache/nba/player_box_${season}.csv`, "utf8"), { columns: true }) as Row[];
const decks = new Map<string, string[]>();
for (const r of box) {
  if (r.reason !== "COACH'S DECISION" && !(Number(r.minutes) > 0)) continue;
  decks.set(r.game_id!, [...(decks.get(r.game_id!) ?? []), r.athlete_id!]);
}

interface Quarter { cards: string[]; points: Map<string, number> }
const quarters: { date: string; q: Quarter }[] = [];
const history = new Map<string, { date: string; perQuarter: number }[]>();
for (const [gameId, rows] of games) {
  const deck = decks.get(gameId);
  if (!deck || deck.length < 16) continue;
  rows.sort((a, b) => Number(a.sequence_number) - Number(b.sequence_number));
  const { game, events } = nbaGameFromRows(rows);
  const scorer = new QuarterScorer(NBA_V1);
  for (const e of events) scorer.apply(e);
  for (const qtr of [1, 2, 3, 4]) quarters.push({ date: game.date, q: { cards: deck, points: new Map(deck.map((p) => [p, scorer.points(qtr, p)])) } });
  for (const p of deck) {
    const total = [1, 2, 3, 4].reduce((s, q) => s + scorer.points(q, p), 0);
    history.set(p, [...(history.get(p) ?? []), { date: game.date, perQuarter: total / 4 }]);
  }
}
const projection = (playerId: string, before: string) => {
  const prior = (history.get(playerId) ?? []).filter((h) => h.date < before);
  return prior.length ? prior.reduce((s, h) => s + h.perQuarter, 0) / prior.length : 0;
};
// Skip each player's first weeks, when there is no projection yet.
const sample = quarters.filter((x) => x.date >= `${Number(season) - 1}-11-15`);
const withProj = sample.map(({ date, q }) => ({ ...q, proj: new Map(q.cards.map((p) => [p, projection(p, date)])) }));

const all = withProj.flatMap((q) => q.cards.map((p) => q.points.get(p)!));
all.sort((a, b) => a - b);
const pct = (xs: number[], p: number) => xs[Math.floor(p * (xs.length - 1))]!;
console.log(`${games.size} games, ${withProj.length} quarters, ${(all.length / withProj.length).toFixed(1)} cards per deck`);
console.log(`per card per quarter: median ${pct(all, 0.5)}, p90 ${pct(all, 0.9)}, p99 ${pct(all, 0.99)}, zero ${(all.filter((x) => x === 0).length / all.length * 100).toFixed(0)}%`);

const rand = seededRandom(2026);
console.log("\nface = 2 + round(k × projected quarter pts), capped 2–10; value = face + w × live points");
console.log(`k     w     | open face median | ${(process.argv[5] ?? "15,17").split(",").map((t) => `hit to ${t}: cards  median  17–21  bust`).join(" | ")}`);
for (const k of (process.argv[3] ?? "0.4,0.5,0.6,0.75").split(",").map(Number)) {
  for (const w of (process.argv[4] ?? "0.15,0.2,0.25,0.33").split(",").map(Number)) {
    const face = (proj: number) => Math.min(10, Math.max(2, 2 + Math.round(k * proj)));
    const cols: string[] = [];
    const opens: number[] = [];
    for (const target of (process.argv[5] ?? "15,17").split(",").map(Number)) {
      const finals: number[] = []; let cards = 0, live = 0;
      for (let i = 0; i < 20000; i++) {
        const q = withProj[Math.floor(rand() * withProj.length)]!;
        const hand: string[] = [];
        const draw = () => { for (;;) { const c = q.cards[Math.floor(rand() * q.cards.length)]!; if (!hand.includes(c)) return c; } };
        hand.push(draw(), draw());
        if (cols.length === 0) opens.push(hand.reduce((s, c) => s + face(q.proj.get(c)!), 0));
        while (hand.reduce((s, c) => s + face(q.proj.get(c)!), 0) < target && hand.length < q.cards.length) hand.push(draw());
        finals.push(hand.reduce((s, c) => s + face(q.proj.get(c)!) + w * q.points.get(c)!, 0));
        live += hand.reduce((s, c) => s + w * q.points.get(c)!, 0);
        cards += hand.length;
      }
      finals.sort((a, b) => a - b);
      const band = finals.filter((x) => x >= 17 && x <= 21).length / finals.length;
      const bust = finals.filter((x) => x > 21).length / finals.length;
      const liveShare = live / finals.reduce((a, b) => a + b, 0);
      cols.push(`${(cards / 20000).toFixed(1).padStart(5)}  ${pct(finals, 0.5).toFixed(1).padStart(6)}  ${(band * 100).toFixed(0).padStart(4)}%  ${(bust * 100).toFixed(0).padStart(3)}%  live ${(liveShare * 100).toFixed(0).padStart(2)}%`);
    }
    opens.sort((a, b) => a - b);
    console.log(`${k.toFixed(2)}  ${w.toFixed(2)}  | ${String(pct(opens, 0.5)).padStart(16)} | ${cols.join("   | ")}`);
  }
}
