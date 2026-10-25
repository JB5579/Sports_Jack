import { describe, expect, it } from "vitest";
import { loadNflverseGame, loadNflversePlayers, type StatDelta } from "../src/index.ts";
import { boxscore, FIXTURES, GAMES, gamePath, OVERTIME_GAMES } from "./fixtures.ts";

const zero = (): Required<StatDelta> => ({
  passYds: 0, passTd: 0, int: 0, sacked: 0, rushYds: 0, rushTd: 0,
  rec: 0, recYds: 0, recTd: 0, fumLost: 0, twoPt: 0, retTd: 0,
  soloTkl: 0, astTkl: 0, sack: 0, defInt: 0, ff: 0, pd: 0, defTd: 0,
});

function totals(gameId: string): Map<string, Required<StatDelta>> {
  const out = new Map<string, Required<StatDelta>>();
  for (const event of loadNflverseGame(gamePath(gameId)).events) {
    if (event.kind !== "play") continue;
    for (const d of event.deltas) {
      const t = out.get(d.playerId) ?? zero();
      for (const [k, v] of Object.entries(d.stats)) t[k as keyof StatDelta] += v;
      out.set(d.playerId, t);
    }
  }
  return out;
}

describe("nflverse replay source on real games", () => {
  it("reads Super Bowl LX in order with four quarters and the real final score", () => {
    const { game, events } = loadNflverseGame(gamePath("2025_22_SEA_NE"));
    expect(game).toMatchObject({ home: "NE", away: "SEA", date: "2026-02-08" });
    expect(events.filter((e) => e.kind === "quarter_end").map((e) => e.clock.qtr)).toEqual([1, 2, 3, 4]);
    const last = events.at(-1)!;
    expect(last.kind).toBe("game_end");
    expect(last.score).toEqual({ home: 13, away: 29 });
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
    expect(events.filter((e) => e.kind === "play").length).toBeGreaterThan(120);
  });

  it("credits a touchdown catch to the receiver and the passer", () => {
    const { events } = loadNflverseGame(gamePath("2025_22_SEA_NE"));
    const td = events.find((e) => e.kind === "play" && e.description.includes("S.Darnold pass deep right to 88-A.Barner"));
    expect(td?.kind === "play" && td.deltas).toEqual([
      { playerId: "00-0034869", name: "S.Darnold", team: "SEA", stats: { passYds: 16, passTd: 1 } },
      { playerId: "00-0039793", name: "A.Barner", team: "SEA", stats: { rec: 1, recYds: 16, recTd: 1 } },
    ]);
  });

  it("ends overtime as its own fifth quarter, whether it ends on a score or runs out", () => {
    const [walkOff, tie] = OVERTIME_GAMES.map((g) => loadNflverseGame(gamePath(g)).events);
    for (const events of [walkOff!, tie!]) {
      expect(events.filter((e) => e.kind === "quarter_end").map((e) => e.clock.qtr)).toEqual([1, 2, 3, 4, 5]);
      expect(events.at(-1)!.kind).toBe("game_end");
    }
    expect(walkOff!.at(-1)!.score).toEqual({ home: 38, away: 37 });
    expect(walkOff!.findLast((e) => e.kind === "quarter_end")!.clock.display).toBe("03:13");
    expect(tie!.at(-1)!.score).toEqual({ home: 40, away: 40 });
  });

  for (const gameId of GAMES) {
    it(`matches nflverse's independent box score for every player in ${gameId}`, () => {
      const ours = totals(gameId);
      const box = boxscore(gameId);
      expect(box.length).toBeGreaterThan(10);
      for (const row of box) {
        // A player nflverse lists with an all-zero line (targeted, never caught) has no deltas.
        const t = ours.get(row.player_id!) ?? zero();
        const label = `${row.player_display_name} (${row.player_id})`;
        expect({ label, passYds: t.passYds, passTd: t.passTd, int: t.int, rushYds: t.rushYds,
          rushTd: t.rushTd, rec: t.rec, recYds: t.recYds, recTd: t.recTd }).toEqual({
          label,
          passYds: Number(row.passing_yards), passTd: Number(row.passing_tds), int: Number(row.passing_interceptions),
          rushYds: Number(row.rushing_yards), rushTd: Number(row.rushing_tds), rec: Number(row.receptions),
          recYds: Number(row.receiving_yards), recTd: Number(row.receiving_tds),
        });
        expect({ label, soloTkl: t.soloTkl, astTkl: t.astTkl, sack: t.sack, defInt: t.defInt, ff: t.ff,
          pd: t.pd, defTd: t.defTd }).toEqual({
          label,
          soloTkl: Number(row.def_tackles_solo), astTkl: Number(row.def_tackle_assists), sack: Number(row.def_sacks),
          defInt: Number(row.def_interceptions), ff: Number(row.def_fumbles_forced), pd: Number(row.def_pass_defended),
          defTd: Number(row.def_tds),
        });
      }
    });
  }

  for (const gameId of GAMES) {
    it(`deals every player who scores in ${gameId} from its game-day roster deck`, () => {
      const deck = loadNflversePlayers(`${FIXTURES}rosters/${gameId}.csv`);
      expect(deck.length).toBeGreaterThan(80);
      const inDeck = new Set(deck.map((p) => p.playerId));
      const scorers = new Set(loadNflverseGame(gamePath(gameId)).events
        .flatMap((e) => (e.kind === "play" ? e.deltas.map((d) => d.playerId) : [])));
      expect([...scorers].filter((id) => !inDeck.has(id))).toEqual([]);
    });
  }
});
