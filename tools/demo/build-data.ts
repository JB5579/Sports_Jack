// Builds the demo's game data from real nflverse play-by-play, with the tested
// feed parser and the sportsjack-v1 ruleset.
//   node --experimental-strip-types tools/demo/build-data.ts > demo/data.json
// Needs the season files in .cache/nflverse (fetch_fixtures.py downloads them).
import { loadNflverseGame, loadNflversePlayers, type PlayEvent } from "../../packages/feed/src/index.ts";
import { SPORTSJACK_V1, scoreStats } from "../../packages/engine/src/index.ts";
import { seasonProjections } from "../nflverse/projections.ts";

const GAMES = [
  { id: "2025_22_SEA_NE", label: "Super Bowl LX" },
  { id: "2025_21_LA_SEA", label: "NFC Championship" },
  { id: "2025_16_LA_SEA", label: "Week 16 · went to overtime" },
];
const FIXTURES = "fixtures/nflverse/";

function cleanDescription(text: string): string {
  return text.replace(/^\(\s*\d*:\d+\)\s*/, "").replace(/\((Shotgun|No Huddle, Shotgun|No Huddle)\)\s*/g, "")
    .replace(/\s+/g, " ").trim().slice(0, 140);
}

const projected = await seasonProjections(2025);
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
