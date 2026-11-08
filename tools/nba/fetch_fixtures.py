#!/usr/bin/env python3
"""Download real NBA play-by-play and extract replay fixtures.

sportsdataverse publishes ESPN's NBA play-by-play and player box scores for every
season (MIT): https://github.com/sportsdataverse/sportsdataverse-data. SportsJack
replays these plays through its feed as if they were live.

    uv run --with pyarrow tools/nba/fetch_fixtures.py                  # default fixture games
    uv run --with pyarrow tools/nba/fetch_fixtures.py --games 401909294
    uv run --with pyarrow tools/nba/fetch_fixtures.py --list 2027      # games available this season
    uv run --with pyarrow tools/nba/fetch_fixtures.py --season-csv 2026  # whole season, for tuning

Seasons are named for the year they end: 2026 is 2025-26. Downloads are cached in
.cache/nba/ (gitignored). Writes fixtures/nba/{games,rosters,boxscores}/<game_id>.csv
and .cache/nba/player_box_<season>.csv, which tools/nba/projections.ts reads.
"""
from __future__ import annotations

import argparse
import csv
import sys
import urllib.request
from pathlib import Path

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "nba"
OUT = ROOT / "fixtures" / "nba"
BASE = "https://github.com/sportsdataverse/sportsdataverse-data/releases/download"
SEASONS = [2026, 2027]

DEFAULT_GAMES = [
    "401859967",  # 2026 NBA Finals, Knicks 94 at Spurs 90, 2026-06-13
    "401873197",  # 2026 playoffs, Spurs 122 at Thunder 115 in double overtime
    "401909294",  # 2026-27 season, Trail Blazers at Lakers, 2026-11-06
]

PLAY_COLUMNS = [
    "game_id", "season", "season_type", "game_date", "sequence_number", "period_number",
    "clock_minutes", "clock_seconds", "type_text", "text", "score_value", "scoring_play",
    "shooting_play", "athlete_id_1", "athlete_name_1", "athlete_id_2", "athlete_name_2",
    "athlete_id_3", "athlete_name_3", "team_id", "home_team_id", "home_team_abbrev",
    "away_team_id", "away_team_abbrev", "home_score", "away_score", "wallclock",
]
ROSTER_COLUMNS = ["athlete_id", "athlete_display_name", "athlete_position_abbreviation", "team_abbreviation", "starter", "did_not_play"]
BOX_COLUMNS = [
    "game_id", "game_date", "athlete_id", "athlete_display_name", "team_abbreviation", "minutes", "points",
    "three_point_field_goals_made", "rebounds", "assists", "steals", "blocks", "turnovers", "did_not_play", "reason",
]


def download(path: str) -> Path:
    target = CACHE / path.replace("/", "__")
    if not target.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"download {BASE}/{path}", file=sys.stderr)
        with urllib.request.urlopen(f"{BASE}/{path}", timeout=600) as response:
            data = response.read()
        target.with_suffix(".part").write_bytes(data)
        target.with_suffix(".part").replace(target)
    return target


def table(path: Path, columns: list[str]) -> list[dict]:
    return pq.read_table(path, columns=columns).to_pylist()


def clean(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else str(value)
    return " ".join(str(value).split())


def write(path: Path, columns: list[str], records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(columns)
        for record in records:
            writer.writerow([clean(record.get(c)) for c in columns])
    print(f"wrote {path.relative_to(ROOT)} ({len(records)} rows)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--games", nargs="+", default=DEFAULT_GAMES)
    parser.add_argument("--list", type=int, metavar="SEASON", help="list available games and exit")
    parser.add_argument("--season-csv", type=int, metavar="SEASON", help="write the whole season's plays and box scores to .cache/nba/ as CSV")
    options = parser.parse_args()

    if options.list:
        rows = table(download(f"espn_nba_pbp/play_by_play_{options.list}.parquet"),
                     ["game_id", "game_date", "away_team_abbrev", "home_team_abbrev"])
        seen = {(r["game_date"], r["game_id"]): f"{r['away_team_abbrev']} at {r['home_team_abbrev']}" for r in rows}
        for (date, game_id), label in sorted(seen.items(), key=lambda kv: (str(kv[0][0]), kv[0][1])):
            print(date, game_id, label)
        return 0

    if options.season_csv:
        season = options.season_csv
        write(CACHE / f"play_by_play_{season}.csv", PLAY_COLUMNS, table(download(f"espn_nba_pbp/play_by_play_{season}.parquet"), PLAY_COLUMNS))
        write(CACHE / f"player_box_{season}.csv", BOX_COLUMNS + ROSTER_COLUMNS[2:5],
              table(download(f"espn_nba_player_boxscores/player_box_{season}.parquet"), BOX_COLUMNS + ROSTER_COLUMNS[2:5]))
        return 0

    wanted = {int(g) for g in options.games}
    for season in SEASONS:
        plays = [r for r in table(download(f"espn_nba_pbp/play_by_play_{season}.parquet"), PLAY_COLUMNS) if r["game_id"] in wanted]
        if not plays:
            continue
        box = table(download(f"espn_nba_player_boxscores/player_box_{season}.parquet"), BOX_COLUMNS + ROSTER_COLUMNS[2:5])
        write(CACHE / f"player_box_{season}.csv", BOX_COLUMNS + ROSTER_COLUMNS[2:5], box)
        for game_id in sorted({r["game_id"] for r in plays}):
            game_plays = sorted((r for r in plays if r["game_id"] == game_id), key=lambda r: int(r["sequence_number"]))
            write(OUT / "games" / f"{game_id}.csv", PLAY_COLUMNS, game_plays)
            game_box = [r for r in box if r["game_id"] == game_id]
            # The deck: everyone dressed for the game, including those the coach never played.
            # Box "active" means on the court at the end; injured or suspended players carry another reason.
            dressed = [r for r in game_box if r["reason"] == "COACH'S DECISION" or (r["minutes"] or 0) > 0]
            write(OUT / "rosters" / f"{game_id}.csv", ROSTER_COLUMNS, dressed)
            write(OUT / "boxscores" / f"{game_id}.csv", BOX_COLUMNS, game_box)
            wanted.discard(game_id)
    if wanted:
        print(f"not found in seasons {SEASONS}: {', '.join(map(str, sorted(wanted)))}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
