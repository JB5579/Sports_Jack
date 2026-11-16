// Variation B: what a safer card should be worth and what it should cost, on real seasons.
//   node --experimental-strip-types --max-old-space-size=6144 tools/analysis/safer_cards.ts
// Needs .cache/nba/{play_by_play,player_box}_2026.csv (tools/nba/fetch_fixtures.py --season-csv 2026)
// and .cache/nflverse/pbp__play_by_play_2025.csv.gz. Results are in docs/analysis/safer-cards.md.
//
// A safer card counts its player's live points at a reduced weight (damping d), so it moves
// less and busts less. Every safer card in a winning hand cuts the winnings by a share X.
// The question: which d and X let a cautious player win more often without beating the
// house edge the standard game already has?
import { createReadStream, readFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { gameFromRows, nbaGameFromRows } from "../../packages/feed/src/index.ts";
import { compareFinish, NBA_V2, QuarterScorer, seededRandom, SPORTSJACK_V1 } from "../../packages/engine/src/index.ts";

type Row = Record<string, string>;
interface Quarter { date: string; cards: string[]; points: Map<string, number>; proj: Map<string, number> }

async function rowsByGame(stream: NodeJS.ReadableStream): Promise<Map<string, Row[]>> {
  const games = new Map<string, Row[]>();
  for await (const row of stream.pipe(parse({ columns: true, relax_quotes: true })) as AsyncIterable<Row>) {
    const list = games.get(row.game_id!) ?? [];
    list.push(row);
    games.set(row.game_id!, list);
  }
  return games;
}

/** Projections from earlier games only, as the app's projections are. */
function withProjections(raw: { date: string; cards: string[]; points: Map<string, number> }[], perGame: Map<string, { date: string; perQuarter: number }[]>, from: string): Quarter[] {
  const projection = (p: string, before: string) => {
    const prior = (perGame.get(p) ?? []).filter((h) => h.date < before);
    return prior.length ? prior.reduce((s, h) => s + h.perQuarter, 0) / prior.length : 0;
  };
  return raw.filter((q) => q.date >= from).map((q) => ({ ...q, proj: new Map(q.cards.map((p) => [p, projection(p, q.date)])) }));
}

async function nbaQuarters(): Promise<Quarter[]> {
  const games = await rowsByGame(createReadStream(".cache/nba/play_by_play_2026.csv"));
  const box = parseSync(readFileSync(".cache/nba/player_box_2026.csv", "utf8"), { columns: true }) as Row[];
  const decks = new Map<string, string[]>();
  for (const r of box) if (r.reason === "COACH'S DECISION" || Number(r.minutes) > 0) decks.set(r.game_id!, [...(decks.get(r.game_id!) ?? []), r.athlete_id!]);
  const raw: { date: string; cards: string[]; points: Map<string, number> }[] = [];
  const perGame = new Map<string, { date: string; perQuarter: number }[]>();
  for (const [gameId, rows] of games) {
    const deck = decks.get(gameId);
    if (!deck || deck.length < 16) continue;
    rows.sort((a, b) => Number(a.sequence_number) - Number(b.sequence_number));
    const { game, events } = nbaGameFromRows(rows);
    const scorer = new QuarterScorer(NBA_V2);
    for (const e of events) scorer.apply(e);
    for (const q of [1, 2, 3, 4]) raw.push({ date: game.date, cards: deck, points: new Map(deck.map((p) => [p, scorer.points(q, p)])) });
    for (const p of deck) perGame.set(p, [...(perGame.get(p) ?? []), { date: game.date, perQuarter: [1, 2, 3, 4].reduce((s, q) => s + scorer.points(q, p), 0) / 4 }]);
  }
  return withProjections(raw, perGame, "2025-11-15");
}

/**
 * NFL decks: every player the play-by-play credits in the game, plus enough never-scoring
 * cards (linemen, specialists) to make the ~92-player game-day roster. The real deck is the
 * nflverse weekly roster; this proxy matches it on who can score.
 */
async function nflQuarters(): Promise<Quarter[]> {
  const games = await rowsByGame(createReadStream(".cache/nflverse/pbp__play_by_play_2025.csv.gz").pipe(createGunzip()));
  const raw: { date: string; cards: string[]; points: Map<string, number> }[] = [];
  const perGame = new Map<string, { date: string; perQuarter: number }[]>();
  for (const [gameId, rows] of games) {
    const { game, events } = gameFromRows(rows);
    const scorer = new QuarterScorer(SPORTSJACK_V1);
    const seen = new Set<string>();
    for (const e of events) { scorer.apply(e); if (e.kind === "play") for (const d of e.deltas) seen.add(d.playerId); }
    const deck = [...seen];
    for (let i = deck.length; i < 92; i++) deck.push(`${gameId}:bench:${i}`);
    for (const q of [1, 2, 3, 4]) raw.push({ date: game.date, cards: deck, points: new Map(deck.map((p) => [p, scorer.points(q, p)])) });
    for (const p of seen) perGame.set(p, [...(perGame.get(p) ?? []), { date: game.date, perQuarter: [1, 2, 3, 4].reduce((s, q) => s + scorer.points(q, p), 0) / 4 }]);
  }
  return withProjections(raw, perGame, "2025-09-25");
}

interface Sport { name: string; k: number; w: number; target: number; quarters: Quarter[] }

/** How a player uses safer cards: which cards they make safer, and where they stop hitting. */
interface Strategy { name: string; target: (base: number) => number; safer: (card: number, faceAfter: number, target: number) => boolean }
const STRATEGIES: Strategy[] = [
  { name: "standard", target: (t) => t, safer: () => false },
  { name: "safer on the last hit", target: (t) => t, safer: (_c, after, t) => after >= t },
  { name: "all safer", target: (t) => t, safer: () => true },
  { name: "all safer, hit 2 higher", target: (t) => t + 2, safer: () => true },
];

const HANDS = 60_000;
const rand = seededRandom(20261116);

function simulate(sport: Sport, d: number, s: Strategy) {
  const face = (p: number) => Math.min(10, Math.max(2, 2 + Math.round(sport.k * p)));
  let win = 0, push = 0, bust = 0, cards = 0;
  const saferInWins: number[] = [];
  for (let i = 0; i < HANDS; i++) {
    const q = sport.quarters[Math.floor(rand() * sport.quarters.length)]!;
    const deal = (hand: string[]) => { for (;;) { const c = q.cards[Math.floor(rand() * q.cards.length)]!; if (!hand.includes(c)) return c; } };
    const faceOf = (h: string[]) => h.reduce((sum, c) => sum + face(q.proj.get(c) ?? 0), 0);
    // The player: hit at the deal to a face target, choosing safer per card as it is dealt.
    const target = s.target(sport.target);
    const mine: string[] = [], safe: boolean[] = [];
    const take = () => { const c = deal(mine); mine.push(c); safe.push(s.safer(mine.length - 1, faceOf(mine), target)); };
    take(); take();
    while (faceOf(mine) < target && mine.length < q.cards.length) take();
    const total = mine.reduce((sum, c, j) => sum + face(q.proj.get(c) ?? 0) + sport.w * (safe[j] ? d : 1) * (q.points.get(c) ?? 0), 0);
    // The easy house dealer, approximated the same way: hit at the deal to a face of 15.
    const dealer: string[] = [deal([]), ""];
    dealer[1] = deal([dealer[0]!]);
    while (faceOf(dealer) < 15) dealer.push(deal(dealer));
    const house = dealer.reduce((sum, c) => sum + face(q.proj.get(c) ?? 0) + sport.w * (q.points.get(c) ?? 0), 0);
    const vs = compareFinish(total, house);
    if (vs < 0) { win++; saferInWins.push(safe.filter(Boolean).length); } else if (vs === 0) push++;
    if (total > 21) bust++;
    cards += mine.length;
  }
  // Expected result per chip of ante for a cut X per safer card: a win pays (1 − X·k), a loss costs 1.
  const ev = (x: number) => (saferInWins.reduce((sum, k) => sum + Math.max(0, 1 - x * k), 0) - (HANDS - win - push)) / HANDS;
  const avgSafer = saferInWins.length ? saferInWins.reduce((a, b) => a + b, 0) / saferInWins.length : 0;
  return { win: win / HANDS, push: push / HANDS, bust: bust / HANDS, cards: cards / HANDS, avgSafer, ev };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const CUTS = [0, 0.1, 0.15, 0.2, 0.25, 0.3];
const sports: Sport[] = [
  { name: "NFL 2025 (sportsjack-v1, face 2 + 2 × proj, live × 0.5)", k: 2, w: 0.5, target: 15, quarters: await nflQuarters() },
  { name: "NBA 2025-26 (nba-v2, face 2 + 0.25 × proj, live × 0.2)", k: 0.25, w: 0.2, target: 13, quarters: await nbaQuarters() },
];
for (const sport of sports) {
  console.log(`\n## ${sport.name}: ${sport.quarters.length} quarters, hit to face ${sport.target}, ${HANDS} hands per row`);
  console.log(`| Damping d | Strategy | Cards | Bust | Win | Push | Safer cards per win | ${CUTS.map((x) => `EV, cut ${x * 100}%`).join(" | ")} |`);
  console.log(`|---|---|---|---|---|---|---|${CUTS.map(() => "---").join("|")}|`);
  for (const d of [0.5, 0.25]) {
    for (const s of STRATEGIES) {
      if (d !== 0.5 && s.name === "standard") continue;
      const r = simulate(sport, d, s);
      console.log(`| ${s.name === "standard" ? "—" : d} | ${s.name} | ${r.cards.toFixed(1)} | ${pct(r.bust)} | ${pct(r.win)} | ${pct(r.push)} | ${r.avgSafer.toFixed(1)} | ${CUTS.map((x) => (s.name === "standard" && x > 0 ? "" : r.ev(x).toFixed(3))).join(" | ")} |`);
    }
  }
}
