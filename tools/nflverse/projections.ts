// Pre-game projections: each player's average sportsjack-v1 points per quarter over
// the earlier games of the season they were active for. Face values come from these.
//   node --experimental-strip-types tools/nflverse/projections.ts   # writes fixtures/nflverse/projections/
// Needs the season files in .cache/nflverse (fetch_fixtures.py downloads them).
import { createReadStream, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { gameFromRows, loadNflverseGame, loadNflversePlayers } from "../../packages/feed/src/index.ts";
import { scoreStats, SPORTSJACK_V1 } from "../../packages/engine/src/index.ts";

const CACHE = ".cache/nflverse/";
const FIXTURES = "fixtures/nflverse/";
type Row = Record<string, string>;

/** The season's games as raw rows, keeping only the columns the feed parser reads. */
export async function seasonGames(season: number): Promise<Map<string, Row[]>> {
  const first = readdirSync(`${FIXTURES}games`)[0]!;
  const keep = readFileSync(`${FIXTURES}games/${first}`, "utf8").split("\n")[0]!.split(",");
  const games = new Map<string, Row[]>();
  const rows = createReadStream(`${CACHE}pbp__play_by_play_${season}.csv.gz`).pipe(createGunzip()).pipe(parse({ columns: true }));
  for await (const full of rows as AsyncIterable<Row>) {
    const row: Row = {};
    for (const key of keep) row[key] = full[key] ?? "NA";
    const list = games.get(row.game_id!) ?? [];
    list.push(row);
    games.set(row.game_id!, list);
  }
  return games;
}

/** Projected points per quarter for a player, using only weeks before `beforeWeek`. */
export async function seasonProjections(season: number): Promise<(playerId: string, beforeWeek: number) => number> {
  const roster = parseSync(readFileSync(`${CACHE}weekly_rosters__roster_weekly_${season}.csv`, "utf8"), { columns: true }) as Row[];
  const activeWeeks = new Map<string, number[]>();
  for (const r of roster) {
    if (r.status !== "ACT") continue;
    const weeks = activeWeeks.get(r.gsis_id!) ?? [];
    weeks.push(Number(r.week));
    activeWeeks.set(r.gsis_id!, weeks);
  }
  const pointsByWeek = new Map<string, Map<number, number>>();
  for (const rows of (await seasonGames(season)).values()) {
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
    return Math.round((total / (weeks.length * 4)) * 100) / 100;
  };
}

if (import.meta.main ?? process.argv[1]?.endsWith("projections.ts")) {
  const gameIds = readdirSync(`${FIXTURES}games`).map((f) => f.replace(/\.csv$/, ""));
  mkdirSync(`${FIXTURES}projections`, { recursive: true });
  for (const season of [...new Set(gameIds.map((g) => Number(g.slice(0, 4))))]) {
    const projected = await seasonProjections(season);
    for (const gameId of gameIds.filter((g) => g.startsWith(`${season}_`))) {
      const { game } = loadNflverseGame(`${FIXTURES}games/${gameId}.csv`);
      const lines = loadNflversePlayers(`${FIXTURES}rosters/${gameId}.csv`)
        .map((p) => `${p.playerId},${projected(p.playerId, game.week)}`);
      writeFileSync(`${FIXTURES}projections/${gameId}.csv`, ["player_id,projected_quarter_points", ...lines].join("\n") + "\n");
      console.log(`wrote ${FIXTURES}projections/${gameId}.csv (${lines.length} players, before week ${game.week})`);
    }
  }
}
