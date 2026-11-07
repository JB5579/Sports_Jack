// Builds the demo's game data from real nflverse play-by-play, with the tested
// feed parser and the sportsjack-v1 ruleset.
//   node --experimental-strip-types tools/demo/build-data.ts > demo/data.json
// Needs the season files in .cache/nflverse (npm run fixtures downloads them).
import { createReadStream, readFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { gameFromRows, loadNflverseGame, loadNflversePlayers, type PlayEvent } from "../../packages/feed/src/index.ts";
import { scoreStats, SPORTSJACK_V1 } from "../../packages/engine/src/index.ts";

const GAMES = [
  { id: "2025_22_SEA_NE", label: "Super Bowl LX" },
  { id: "2025_21_LA_SEA", label: "NFC Championship" },
  { id: "2025_16_LA_SEA", label: "Week 16 · went to overtime" },
];
const CACHE = ".cache/nflverse/";
const FIXTURES = "fixtures/nflverse/";
type Row = Record<string, string>;

// Only the columns the feed parser reads, taken from a fixture's header.
const keep = readFileSync(`${FIXTURES}games/${GAMES[0]!.id}.csv`, "utf8").split("\n")[0]!.split(",");

async function seasonGames(): Promise<Map<string, Row[]>> {
  const games = new Map<string, Row[]>();
  const rows = createReadStream(`${CACHE}pbp__play_by_play_2025.csv.gz`).pipe(createGunzip()).pipe(parse({ columns: true }));
  for await (const full of rows as AsyncIterable<Row>) {
    const row: Row = {};
    for (const key of keep) row[key] = full[key] ?? "NA";
    const list = games.get(row.game_id!) ?? [];
    list.push(row);
    games.set(row.game_id!, list);
  }
  return games;
}

// Pre-game projection: average points per quarter over earlier games the player was active for.
function projections(games: Map<string, Row[]>): (playerId: string, beforeWeek: number) => number {
  const roster = parseSync(readFileSync(`${CACHE}weekly_rosters__roster_weekly_2025.csv`, "utf8"), { columns: true }) as Row[];
  const activeWeeks = new Map<string, number[]>();
  for (const r of roster) {
    if (r.status !== "ACT") continue;
    const weeks = activeWeeks.get(r.gsis_id!) ?? [];
    weeks.push(Number(r.week));
    activeWeeks.set(r.gsis_id!, weeks);
  }
  const pointsByWeek = new Map<string, Map<number, number>>();
  for (const rows of games.values()) {
    const { game, events } = gameFromRows(rows);
    for (const e of events) {
      if (e.kind !== "play" || e.clock.qtr > 4) continue;
      for (const d of e.deltas) {
        const weeks = pointsByWeek.get(d.playerId) ?? new Map<number, number>();
        weeks.set(game.week, (weeks.get(game.week) ?? 0) + scoreStats(d.stats, SPORTSJACK_V1));
        pointsByWeek.set(d.playerId, weeks);
      }
    }
  }
  return (playerId, beforeWeek) => {
    const weeks = (activeWeeks.get(playerId) ?? []).filter((w) => w < beforeWeek);
    if (weeks.length === 0) return 0;
    const points = pointsByWeek.get(playerId);
    const total = weeks.reduce((sum, w) => sum + (points?.get(w) ?? 0), 0);
    return total / (weeks.length * 4);
  };
}

function cleanDescription(text: string): string {
  return text.replace(/^\(\s*\d*:\d+\)\s*/, "").replace(/\((Shotgun|No Huddle, Shotgun|No Huddle)\)\s*/g, "")
    .replace(/\s+/g, " ").trim().slice(0, 140);
}

const games = await seasonGames();
const projected = projections(games);
const out = GAMES.map(({ id, label }) => {
  const { game, events } = loadNflverseGame(`${FIXTURES}games/${id}.csv`);
  const deck = loadNflversePlayers(`${FIXTURES}rosters/${id}.csv`);
  const index = new Map(deck.map((p, i) => [p.playerId, i]));
  const plays = events.filter((e): e is PlayEvent => e.kind === "play");
  const last = events.at(-1)!;
  return {
    id, label, date: game.date, home: game.home, away: game.away, week: game.week,
    final: last.score,
    // Each hand's real clock: overtime is 10 minutes in the regular season, 15 in the playoffs,
    // and ends early on a score.
    periods: events.filter((e) => e.kind === "quarter_end").map((e) => ({
      q: e.clock.qtr, start: e.clock.qtr <= 4 || game.week > 18 ? 900 : 600, end: e.clock.quarterSecondsRemaining,
    })),
    rules: SPORTSJACK_V1.id,
    deck: deck.map((p) => {
      const proj = projected(p.playerId, game.week);
      return { n: p.name, p: p.position, t: p.team, proj: Math.round(proj * 100) / 100,
        f: Math.min(10, Math.max(2, 2 + Math.round(2 * proj))) };
    }),
    plays: plays.map((e) => ({
      q: e.clock.qtr, c: e.clock.quarterSecondsRemaining, s: [e.score.away, e.score.home],
      d: cleanDescription(e.description),
      x: e.deltas.filter((d) => index.has(d.playerId))
        .map((d) => [index.get(d.playerId), scoreStats(d.stats, SPORTSJACK_V1), d.stats]),
    })),
  };
});
process.stdout.write(JSON.stringify({ source: "nflverse play-by-play (CC-BY 4.0)", games: out }));
