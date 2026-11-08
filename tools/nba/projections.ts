// Pre-game projections for NBA fixture games: each player's average nba-v1 points per
// quarter over the season's earlier games he dressed for. Face values come from these.
//   uv run --with pyarrow tools/nba/fetch_fixtures.py        # writes .cache/nba/player_box_<season>.csv
//   node --experimental-strip-types tools/nba/projections.ts  # writes fixtures/nba/projections/
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { loadNbaGame, loadNbaRoster, type StatDelta } from "../../packages/feed/src/index.ts";
import { NBA_V1, scoreStats } from "../../packages/engine/src/index.ts";

type Row = Record<string, string>;
const FIXTURES = "fixtures/nba/";
const n = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : 0);

/** A player's box-score line as the feed's stats; matches the play-by-play totals (see nba.test.ts). */
const statsOf = (r: Row): StatDelta => ({
  pts: n(r.points), fg3m: n(r.three_point_field_goals_made), reb: n(r.rebounds), ast: n(r.assists),
  stl: n(r.steals), blk: n(r.blocks), tov: n(r.turnovers),
});

mkdirSync(`${FIXTURES}projections`, { recursive: true });
const boxes = new Map<number, Row[]>();
for (const file of readdirSync(`${FIXTURES}games`)) {
  const gameId = file.replace(/\.csv$/, "");
  const { game } = loadNbaGame(`${FIXTURES}games/${file}`);
  if (!boxes.has(game.season)) {
    boxes.set(game.season, parse(readFileSync(`.cache/nba/player_box_${game.season}.csv`, "utf8"), { columns: true }) as Row[]);
  }
  const prior = boxes.get(game.season)!.filter((r) => r.game_date! < game.date && (r.reason === "COACH'S DECISION" || n(r.minutes) > 0));
  const lines = loadNbaRoster(`${FIXTURES}rosters/${file}`).map((p) => {
    const games = prior.filter((r) => r.athlete_id === p.playerId);
    const perQuarter = games.length ? games.reduce((s, r) => s + scoreStats(statsOf(r), NBA_V1), 0) / (games.length * 4) : 0;
    return `${p.playerId},${Math.round(perQuarter * 100) / 100}`;
  });
  writeFileSync(`${FIXTURES}projections/${gameId}.csv`, ["player_id,projected_quarter_points", ...lines].join("\n") + "\n");
  console.log(`wrote ${FIXTURES}projections/${gameId}.csv (${lines.length} players, games before ${game.date})`);
}
