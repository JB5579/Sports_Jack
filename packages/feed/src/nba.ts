import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import type { RecordedGame } from "./nflverse.ts";
import type { FeedEvent, GameInfo, Player, PlayerDelta, StatDelta } from "./types.ts";

type Row = Record<string, string>;

function readCsv(path: string): Row[] {
  return parse(readFileSync(path, "utf8"), { columns: true, skip_empty_lines: true }) as Row[];
}

const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : 0);
const id = (v: string | undefined) => (v ? v : undefined);

function clockDisplay(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Credit the stats of one ESPN NBA play. Made shots credit the shooter (and the
 * assister, named second); turnovers credit the player who lost it and the stealer;
 * a blocked shot credits the blocker, named second. Team rebounds and team turnovers
 * name no player and credit nobody.
 */
export function nbaPlayDeltas(row: Row, teams: Map<string, string>): PlayerDelta[] {
  const byPlayer = new Map<string, PlayerDelta>();
  const team = teams.get(row.team_id ?? "") ?? "";
  const other = [...teams.values()].find((t) => t !== team) ?? "";
  const credit = (playerId: string | undefined, name: string | undefined, stats: StatDelta, side = team) => {
    if (!playerId) return;
    const entry = byPlayer.get(playerId) ?? { playerId, name: name || playerId, team: side, stats: {} };
    for (const [k, v] of Object.entries(stats) as [keyof StatDelta, number][]) entry.stats[k] = (entry.stats[k] ?? 0) + v;
    byPlayer.set(playerId, entry);
  };
  const type = row.type_text ?? "";
  const text = (row.text ?? "").toLowerCase();
  const first = id(row.athlete_id_1), second = id(row.athlete_id_2);
  if (row.scoring_play === "True" && row.shooting_play === "True") {
    const points = num(row.score_value);
    credit(first, row.athlete_name_1, { pts: points, ...(points === 3 ? { fg3m: 1 } : {}) });
    if (text.includes("assists")) credit(second, row.athlete_name_2, { ast: 1 });
  }
  if (type.includes("Rebound")) credit(first, row.athlete_name_1, { reb: 1 });
  // Some turnovers say so only in their text ("Traveling" → "... traveling turnover").
  if (type.includes("Turnover") || text.includes("turnover")) {
    credit(first, row.athlete_name_1, { tov: 1 });
    if (text.includes("steals")) credit(second, row.athlete_name_2, { stl: 1 }, other);
  }
  if (text.includes(" blocks ")) credit(second, row.athlete_name_2, { blk: 1 }, other);
  return [...byPlayer.values()];
}

/**
 * One NBA game's play-by-play (fixtures/nba/games) as ordered feed events. ESPN
 * sometimes logs late corrections after "End Game"; they are kept so stat totals match
 * the box score, but a replay stops at each period's end, so they never move a settled
 * hand (MISSION.md invariant 2).
 */
export function nbaGameFromRows(rows: Row[]): RecordedGame {
  const first = rows[0];
  if (!first) throw new Error("no plays");
  const game: GameInfo = {
    sport: "nba",
    gameId: first.game_id ?? "",
    season: num(first.season),
    week: 0,
    date: first.game_date ?? "",
    home: first.home_team_abbrev ?? "",
    away: first.away_team_abbrev ?? "",
    playoffs: first.season_type === "3",
  };
  const teams = new Map([[first.home_team_id ?? "", game.home], [first.away_team_id ?? "", game.away]]);
  const events: FeedEvent[] = [];
  for (const row of rows) {
    const qtr = num(row.period_number);
    const remaining = num(row.clock_minutes) * 60 + num(row.clock_seconds);
    const base = {
      gameId: game.gameId,
      seq: events.length,
      clock: { qtr, quarterSecondsRemaining: remaining, display: clockDisplay(remaining) },
      score: { home: num(row.home_score), away: num(row.away_score) },
      ...(row.wallclock ? { wallClock: row.wallclock } : {}),
    };
    if (row.type_text === "End Period") { events.push({ ...base, kind: "quarter_end" }); continue; }
    if (row.type_text === "End Game") { events.push({ ...base, kind: "game_end" }); continue; }
    events.push({
      ...base,
      kind: "play",
      playId: row.sequence_number ?? String(events.length),
      possession: teams.get(row.team_id ?? "") ?? "",
      description: row.text ?? "",
      deltas: nbaPlayDeltas(row, teams),
    });
  }
  return { game, events };
}

export function loadNbaGame(path: string): RecordedGame {
  return nbaGameFromRows(readCsv(path));
}

/** The players dressed for an NBA game (fixtures/nba/rosters): the deck. */
export function loadNbaRoster(path: string): Player[] {
  return readCsv(path).map((row) => ({
    playerId: row.athlete_id ?? "",
    name: row.athlete_display_name ?? "",
    position: row.athlete_position_abbreviation ?? "",
    team: row.team_abbreviation ?? "",
  }));
}
