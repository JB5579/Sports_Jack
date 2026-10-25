#!/usr/bin/env python3
"""Download real NFL play-by-play from nflverse and extract replay fixtures.

nflverse publishes every play of every game (updated nightly in season) under
CC-BY 4.0: https://github.com/nflverse/nflverse-data. SportsJack replays these
plays through its feed as if they were live, so tests and journeys run on real
games without a live provider.

    python3 tools/nflverse/fetch_fixtures.py                    # default fixture games
    python3 tools/nflverse/fetch_fixtures.py --games 2026_07_NE_CHI 2025_22_SEA_NE
    python3 tools/nflverse/fetch_fixtures.py --list 2026        # games available this season

Standard library only. Downloads are cached in .cache/nflverse/ (gitignored).
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "nflverse"
OUT = ROOT / "fixtures" / "nflverse"
BASE = "https://github.com/nflverse/nflverse-data/releases/download"

DEFAULT_GAMES = [
    "2025_22_SEA_NE",   # Super Bowl LX, 2026-02-08
    "2025_21_LA_SEA",   # NFC Championship, 31-27 shootout
    "2025_16_LA_SEA",   # overtime that ends on a score, 38-37
    "2025_04_GB_DAL",   # overtime that runs out, 40-40 tie
    "2026_07_NE_CHI",   # 2026 season, Thursday Week 7
]

PLAY_COLUMNS = [
    "game_id", "play_id", "season", "week", "game_date", "home_team", "away_team",
    "posteam", "defteam", "qtr", "quarter_seconds_remaining", "game_seconds_remaining",
    "time", "time_of_day", "play_type", "desc", "two_point_attempt", "two_point_conv_result",
    "sack", "interception", "fumble_lost", "complete_pass", "pass_touchdown",
    "rush_touchdown", "return_touchdown", "td_player_id", "td_player_name",
    "passer_player_id", "passer_player_name", "passing_yards",
    "receiver_player_id", "receiver_player_name", "receiving_yards",
    "rusher_player_id", "rusher_player_name", "rushing_yards",
    "fumbled_1_player_id", "fumbled_1_player_name", "total_home_score", "total_away_score",
    "touchdown", "td_team",
    # Defense and coverage, credited on every play, kicks included, as nflverse does.
    "solo_tackle_1_player_id", "solo_tackle_1_player_name", "solo_tackle_1_team",
    "solo_tackle_2_player_id", "solo_tackle_2_player_name", "solo_tackle_2_team",
    "assist_tackle_1_player_id", "assist_tackle_1_player_name", "assist_tackle_1_team",
    "assist_tackle_2_player_id", "assist_tackle_2_player_name", "assist_tackle_2_team",
    "sack_player_id", "sack_player_name", "half_sack_1_player_id", "half_sack_1_player_name",
    "half_sack_2_player_id", "half_sack_2_player_name",
    "interception_player_id", "interception_player_name",
    "forced_fumble_player_1_player_id", "forced_fumble_player_1_player_name", "forced_fumble_player_1_team",
    "forced_fumble_player_2_player_id", "forced_fumble_player_2_player_name", "forced_fumble_player_2_team",
    "pass_defense_1_player_id", "pass_defense_1_player_name",
    "pass_defense_2_player_id", "pass_defense_2_player_name",
]
PLAYER_ID_COLUMNS = [c for c in PLAY_COLUMNS if c.endswith("player_id")]
PLAYER_COLUMNS = ["gsis_id", "full_name", "position", "team", "season"]
# The deck: every player on both teams' game-day active roster (status ACT).
ROSTER_COLUMNS = ["gsis_id", "espn_id", "full_name", "position", "depth_chart_position", "team", "week", "status"]
STAT_COLUMNS = [
    "player_id", "player_display_name", "position", "team", "season", "week",
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
    "sacks_suffered", "carries", "rushing_yards", "rushing_tds", "receptions",
    "receiving_yards", "receiving_tds", "rushing_fumbles_lost", "receiving_fumbles_lost",
    "sack_fumbles_lost", "fantasy_points_ppr",
    "def_tackles_solo", "def_tackle_assists", "def_sacks", "def_interceptions",
    "def_fumbles_forced", "def_pass_defended", "def_tds",
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


def rows(path: Path):
    raw = path.read_bytes()
    if path.name.endswith(".gz"):
        raw = gzip.decompress(raw)
    yield from csv.DictReader(io.StringIO(raw.decode("utf-8")))


def write(path: Path, columns: list[str], records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(records)
    print(f"wrote {path.relative_to(ROOT)} ({len(records)} rows)")


def season_of(game_id: str) -> int:
    return int(game_id.split("_")[0])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--games", nargs="+", default=DEFAULT_GAMES)
    parser.add_argument("--list", type=int, metavar="SEASON", help="list available games and exit")
    options = parser.parse_args()

    if options.list:
        seen: dict[str, str] = {}
        for row in rows(download(f"pbp/play_by_play_{options.list}.csv.gz")):
            seen.setdefault(row["game_id"], row["game_date"])
        for game_id, date in sorted(seen.items(), key=lambda item: (item[1], item[0])):
            print(date, game_id)
        return 0

    for season in sorted({season_of(g) for g in options.games}):
        wanted = {g for g in options.games if season_of(g) == season}
        plays: dict[str, list[dict]] = {g: [] for g in wanted}
        for row in rows(download(f"pbp/play_by_play_{season}.csv.gz")):
            if row["game_id"] in wanted:
                plays[row["game_id"]].append(row)
        missing = [g for g, found in plays.items() if not found]
        if missing:
            print(f"not found in {season} play-by-play: {', '.join(missing)}", file=sys.stderr)
            return 1
        ids, weeks = set(), {}
        for game_id, records in plays.items():
            write(OUT / "games" / f"{game_id}.csv", PLAY_COLUMNS, records)
            weeks[(records[0]["week"], records[0]["home_team"])] = game_id
            weeks[(records[0]["week"], records[0]["away_team"])] = game_id
            for record in records:
                for key in PLAYER_ID_COLUMNS:
                    if record[key] and record[key] != "NA":
                        ids.add(record[key])
        roster = [r for r in rows(download(f"rosters/roster_{season}.csv")) if r["gsis_id"] in ids]
        write(OUT / "players" / f"{season}.csv", PLAYER_COLUMNS, roster)
        stats = [r for r in rows(download(f"stats_player/stats_player_week_{season}.csv.gz"))
                 if (r["week"], r["team"]) in weeks and r["player_id"] in ids]
        active = [r for r in rows(download(f"weekly_rosters/roster_weekly_{season}.csv"))
                  if (r["week"], r["team"]) in weeks and r["status"] == "ACT"]
        for game_id in wanted:
            write(OUT / "rosters" / f"{game_id}.csv", ROSTER_COLUMNS,
                  [r for r in active if weeks[(r["week"], r["team"])] == game_id])
        for record in stats:
            record["game_id"] = weeks[(record["week"], record["team"])]
        for game_id in wanted:
            write(OUT / "boxscores" / f"{game_id}.csv", ["game_id"] + STAT_COLUMNS,
                  [r for r in stats if r["game_id"] == game_id])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
