import { compareFinish, type Finish } from "./settlement.ts";

/**
 * A contest is what a hand is played for: who may enter, what entry costs, how cards are
 * dealt and who is paid (prd/FOUNDATION.md §3). The rules of the hand itself (GameRules)
 * do not change with the contest. Dealer tables, player tables, practice hands and pooled
 * free contests are all contests with different settings.
 */

/** What it costs to be dealt in. */
export type EntryRule = { kind: "free" } | { kind: "chips"; amount: number };

/**
 * Who is paid.
 * - `none`: nothing is paid and nothing is recorded (practice).
 * - `table`: the hand's own settlement: even money against the dealer, or winners split
 *   the antes after rake at a player table.
 * - `pool`: fixed prizes by finishing place among the players, paid by a sponsor account.
 */
export type PrizeRule =
  | { kind: "none" }
  | { kind: "table" }
  | { kind: "pool"; amounts: number[]; sponsor: string; sponsorName: string };

export interface ContestRules {
  name: string;
  entry: EntryRule;
  prize: PrizeRule;
  /** `shared`: every player is dealt the same cards, so only decisions separate them. */
  deal: "own" | "shared";
  /** Most players who can sit; null for no limit. */
  seats: number | null;
  /** At a player table, fill empty seats with labeled bots up to this many seats; 0 for no bots. */
  fillWithBots: number;
}

export const entryAmount = (rules: ContestRules): number => (rules.entry.kind === "chips" ? rules.entry.amount : 0);

/** Check a contest's settings. Returns the first problem, or null when it is valid. */
export function contestProblem(rules: ContestRules): string | null {
  if (rules.entry.kind === "chips" && !(Number.isSafeInteger(rules.entry.amount) && rules.entry.amount > 0)) return "entry must be a positive whole number of chips";
  if (rules.prize.kind === "pool") {
    if (rules.prize.amounts.length === 0) return "a pool needs at least one prize";
    if (rules.prize.amounts.some((a) => !(Number.isSafeInteger(a) && a > 0))) return "prizes must be positive whole numbers";
    if (!rules.prize.sponsor.startsWith("sponsor:")) return "a pool's sponsor account starts with sponsor:";
    // Paid entry for a sponsored prize, or a pot nobody funded, mixes two models.
    if (rules.entry.kind !== "free") return "a pool is free to enter";
  }
  if (rules.prize.kind === "table" && rules.entry.kind === "free") return "a table prize is paid from entries, so entry cannot be free";
  if (rules.seats !== null && !(Number.isSafeInteger(rules.seats) && rules.seats > 0)) return "seats must be a positive whole number or no limit";
  if (!(Number.isSafeInteger(rules.fillWithBots) && rules.fillWithBots >= 0)) return "fillWithBots must be zero or more";
  return null;
}

/**
 * Pool prizes by place. Only finishes at or under 21 can win. Players tied for a place
 * share the prizes of the places they cover, rounded down; what rounding leaves stays with
 * the sponsor. Everyone else gets nothing.
 */
export function poolPayouts(finishes: Finish[], amounts: number[]): Map<string, number> {
  const payouts = new Map(finishes.map((f) => [f.seatId, 0]));
  const eligible = finishes.filter((f) => f.total <= 21).sort((a, b) => compareFinish(a.total, b.total));
  let place = 0;
  while (place < eligible.length && place < amounts.length) {
    const tied = eligible.filter((f) => compareFinish(f.total, eligible[place]!.total) === 0);
    const prize = amounts.slice(place, place + tied.length).reduce((sum, a) => sum + a, 0);
    const share = Math.floor(prize / tied.length);
    for (const f of tied) payouts.set(f.seatId, share);
    place += tied.length;
  }
  return payouts;
}
