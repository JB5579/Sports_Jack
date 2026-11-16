/** Where a hand finished, as settlement sees it. */
export interface Finish {
  seatId: string;
  total: number;
  /** Safer cards in the hand at the whistle; each cuts the winnings (docs/analysis/safer-cards.md). */
  safer?: number;
}

/**
 * What a winner is paid back after the safer-card cut: the stake, plus the profit less
 * `cutPerCard` for each safer card, rounded down to whole chips. Never less than the stake.
 */
export function afterSaferCut(stake: number, payout: number, safer: number, cutPerCard: number): number {
  if (!safer || !cutPerCard || payout <= stake) return payout;
  return stake + Math.floor((payout - stake) * Math.max(0, 1 - cutPerCard * safer));
}

export interface Standing extends Finish {
  bust: boolean;
  rank: number;
  payout: number;
}

export interface Settlement {
  standings: Standing[];
  /** Every ante in the hand. */
  pot: number;
  /** What the house keeps: the rake at a player table, the dealer's net against players. Can be negative. */
  house: number;
}

/**
 * Closest to 21 without going over wins; any non-bust beats any bust; among busts the
 * one closest from above wins (MISSION.md Q7). Negative when `a` finished ahead.
 */
export function compareFinish(a: number, b: number): number {
  const bustA = a > 21, bustB = b > 21;
  if (bustA !== bustB) return bustA ? 1 : -1;
  return bustA ? a - b : b - a;
}

function ranked(finishes: Finish[]): Standing[] {
  const sorted = [...finishes].sort((x, y) => compareFinish(x.total, y.total));
  return sorted.map((f) => ({
    ...f,
    bust: f.total > 21,
    rank: 1 + sorted.findIndex((g) => compareFinish(g.total, f.total) === 0),
    payout: 0,
  }));
}

/** Player table: winners split the pot after rake; the remainder of an uneven split goes to the house. */
export function settlePlayers(finishes: Finish[], ante: number, rakeShare: number, cutPerCard = 0): Settlement {
  const standings = ranked(finishes);
  const pot = ante * finishes.length;
  const rake = Math.round(pot * rakeShare);
  const winners = standings.filter((s) => s.rank === 1);
  const share = Math.floor((pot - rake) / winners.length);
  for (const w of winners) w.payout = afterSaferCut(ante, share, w.safer ?? 0, cutPerCard);
  return { standings, pot, house: pot - winners.reduce((sum, w) => sum + w.payout, 0) };
}

/** Against the dealer: each player wins even money, pushes on a tie, or loses the ante. */
export function settleDealer(players: Finish[], dealer: Finish, ante: number, cutPerCard = 0): Settlement {
  const standings = ranked([...players, dealer]);
  for (const s of standings) {
    if (s.seatId === dealer.seatId) continue;
    const vs = compareFinish(s.total, dealer.total);
    s.payout = vs < 0 ? afterSaferCut(ante, ante * 2, s.safer ?? 0, cutPerCard) : vs === 0 ? ante : 0;
  }
  const paid = standings.reduce((sum, s) => sum + s.payout, 0);
  return { standings, pot: ante * players.length, house: ante * players.length - paid };
}
