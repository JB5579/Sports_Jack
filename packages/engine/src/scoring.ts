import type { FeedEvent, StatDelta, StatKey } from "@sportsjack/feed";

/** Points per unit of each stat. A ruleset is frozen per season and shown to users. */
export interface ScoringRules {
  id: string;
  points: Record<StatKey, number>;
}

/** Industry-standard full PPR. Matches nflverse's `fantasy_points_ppr`, which tests use as an oracle. */
export const STANDARD_PPR: ScoringRules = {
  id: "standard-ppr",
  points: {
    passYds: 0.04, passTd: 4, int: -2, sacked: 0,
    rushYds: 0.1, rushTd: 6, rec: 1, recYds: 0.1, recTd: 6,
    fumLost: -2, twoPt: 2,
  },
};

/** PRD §4.1 table: standard PPR plus −1 per sack taken. Not final; see MISSION.md Q1. */
export const SPORTSJACK_V0: ScoringRules = {
  id: "sportsjack-v0",
  points: { ...STANDARD_PPR.points, sacked: -1 },
};

export function scoreStats(stats: StatDelta, rules: ScoringRules): number {
  let total = 0;
  for (const [key, value] of Object.entries(stats) as [StatKey, number][]) {
    total += value * rules.points[key];
  }
  return round(total);
}

export function round(points: number): number {
  return Math.round(points * 100) / 100;
}

/**
 * Live fantasy points per player, kept separately for each quarter, because one
 * quarter is one hand. Feed it events in order; read values at any moment.
 */
export class QuarterScorer {
  readonly rules: ScoringRules;
  readonly #byQuarter = new Map<number, Map<string, number>>();

  constructor(rules: ScoringRules = SPORTSJACK_V0) {
    this.rules = rules;
  }

  apply(event: FeedEvent): void {
    if (event.kind !== "play") return;
    const quarter = this.#quarter(event.clock.qtr);
    for (const delta of event.deltas) {
      const before = quarter.get(delta.playerId) ?? 0;
      quarter.set(delta.playerId, round(before + scoreStats(delta.stats, this.rules)));
    }
  }

  /** A player's points in one quarter so far; 0 if they have not touched the ball. */
  points(qtr: number, playerId: string): number {
    return this.#byQuarter.get(qtr)?.get(playerId) ?? 0;
  }

  quarter(qtr: number): ReadonlyMap<string, number> {
    return this.#quarter(qtr);
  }

  #quarter(qtr: number): Map<string, number> {
    let quarter = this.#byQuarter.get(qtr);
    if (!quarter) this.#byQuarter.set(qtr, (quarter = new Map()));
    return quarter;
  }
}
