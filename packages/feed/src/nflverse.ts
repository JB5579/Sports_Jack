import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import type { FeedEvent, GameInfo, Player, PlayerDelta, StatDelta } from "./types.ts";

type Row = Record<string, string>;

const SCRIMMAGE = new Set(["pass", "run", "qb_kneel", "qb_spike"]);

function readCsv(path: string): Row[] {
  return parse(readFileSync(path, "utf8"), { columns: true, skip_empty_lines: true }) as Row[];
}

function num(value: string | undefined): number {
  if (value === undefined || value === "" || value === "NA") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function id(value: string | undefined): string | undefined {
  return value && value !== "NA" ? value : undefined;
}

function clockDisplay(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Credit the stat changes of one nflverse play to the players involved. */
export function playDeltas(row: Row): PlayerDelta[] {
  const isScrimmage = SCRIMMAGE.has(row.play_type ?? "") || row.sack === "1";
  if (!isScrimmage) return [];
  const team = row.posteam ?? "";
  const byPlayer = new Map<string, PlayerDelta>();
  const credit = (playerId: string | undefined, name: string | undefined, stats: StatDelta) => {
    if (!playerId) return;
    const entry = byPlayer.get(playerId) ?? { playerId, name: name ?? playerId, team, stats: {} };
    for (const [key, value] of Object.entries(stats) as [keyof StatDelta, number][]) {
      if (value) entry.stats[key] = (entry.stats[key] ?? 0) + value;
    }
    byPlayer.set(playerId, entry);
  };

  const passer = id(row.passer_player_id);
  const receiver = id(row.receiver_player_id);
  const rusher = id(row.rusher_player_id);
  const scorer = id(row.td_player_id);

  if (row.two_point_attempt === "1") {
    if (row.two_point_conv_result === "success") {
      credit(passer, row.passer_player_name, { twoPt: 1 });
      credit(receiver, row.receiver_player_name, { twoPt: 1 });
      credit(rusher, row.rusher_player_name, { twoPt: 1 });
    }
    return [...byPlayer.values()].filter((d) => Object.keys(d.stats).length > 0);
  }

  const passTd = row.pass_touchdown === "1";
  credit(passer, row.passer_player_name, {
    passYds: num(row.passing_yards),
    passTd: passTd ? 1 : 0,
    int: row.interception === "1" ? 1 : 0,
    sacked: row.sack === "1" ? 1 : 0,
  });
  credit(receiver, row.receiver_player_name, {
    rec: row.complete_pass === "1" ? 1 : 0,
    recYds: num(row.receiving_yards),
    recTd: passTd && scorer === receiver ? 1 : 0,
  });
  credit(rusher, row.rusher_player_name, {
    rushYds: num(row.rushing_yards),
    rushTd: row.rush_touchdown === "1" && scorer === rusher ? 1 : 0,
  });
  if (row.fumble_lost === "1") credit(id(row.fumbled_1_player_id), row.fumbled_1_player_name, { fumLost: 1 });

  return [...byPlayer.values()].filter((d) => Object.keys(d.stats).length > 0);
}

export interface RecordedGame {
  game: GameInfo;
  events: FeedEvent[];
}

/** Turn one game's nflverse play-by-play rows into ordered feed events. */
export function gameFromRows(rows: Row[]): RecordedGame {
  const first = rows[0];
  if (!first) throw new Error("no plays");
  const game: GameInfo = {
    gameId: first.game_id ?? "",
    season: num(first.season),
    week: num(first.week),
    date: first.game_date ?? "",
    home: first.home_team ?? "",
    away: first.away_team ?? "",
  };
  const events: FeedEvent[] = [];
  const quartersEnded = new Set<number>();
  let lastWall: string | undefined;
  for (const row of rows) {
    const qtr = num(row.qtr);
    const quarterSecondsRemaining = row.quarter_seconds_remaining === "NA" ? 0 : num(row.quarter_seconds_remaining);
    const wall = id(row.time_of_day);
    if (wall) lastWall = wall;
    const base = {
      gameId: game.gameId,
      seq: events.length,
      clock: { qtr, quarterSecondsRemaining, display: clockDisplay(quarterSecondsRemaining) },
      score: { home: num(row.total_home_score), away: num(row.total_away_score) },
      ...(lastWall ? { wallClock: lastWall } : {}),
    };
    const desc = row.desc ?? "";
    if (/^END QUARTER \d/.test(desc) && !quartersEnded.has(qtr)) {
      quartersEnded.add(qtr);
      events.push({ ...base, kind: "quarter_end" });
      continue;
    }
    if (desc === "END GAME") {
      if (!quartersEnded.has(qtr)) events.push({ ...base, kind: "quarter_end" });
      quartersEnded.add(qtr);
      events.push({ ...base, seq: events.length, kind: "game_end" });
      continue;
    }
    if (desc === "GAME" || !row.play_type || row.play_type === "NA") continue;
    events.push({
      ...base,
      kind: "play",
      playId: row.play_id ?? "",
      possession: row.posteam ?? "",
      description: desc,
      deltas: playDeltas(row),
    });
  }
  return { game, events };
}

export function loadNflverseGame(path: string): RecordedGame {
  return gameFromRows(readCsv(path));
}

export function loadNflversePlayers(path: string): Player[] {
  return readCsv(path).map((row) => ({
    playerId: row.gsis_id ?? "",
    name: row.full_name ?? "",
    position: row.position ?? "",
    team: row.team ?? "",
  }));
}
