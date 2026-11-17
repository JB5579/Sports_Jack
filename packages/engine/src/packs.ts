import { roundValue } from "./rules.ts";

/**
 * Variation C: collectible player cards and "hit for a pack" (MVP requirements 2026-11-16).
 * Pack cards are collectibles only: they never play in a hand. Tiers are Gianni's set
 * values, read as play-money chips, and a card sells back for exactly its tier's value.
 */
export const TIERS = [
  { id: "common", name: "Common", chips: 1 },
  { id: "uncommon", name: "Uncommon", chips: 5 },
  { id: "rare", name: "Rare", chips: 20 },
  { id: "epic", name: "Epic", chips: 50 },
  { id: "legendary", name: "Legendary", chips: 100 },
  { id: "grail", name: "Grail", chips: 1000 },
] as const;
export type TierId = (typeof TIERS)[number]["id"];

/**
 * The pack a run earns by where it stops: anywhere from 16 to 21 wins one, and a tighter
 * landing wins a better one. Each pack holds three cards; the odds are per card, in tier order.
 */
export const PACKS = [
  { id: "bronze", name: "Bronze pack", from: 16, odds: [0.8, 0.17, 0.025, 0.004, 0.0009, 0.0001] },
  { id: "silver", name: "Silver pack", from: 18, odds: [0.62, 0.3, 0.06, 0.015, 0.004, 0.001] },
  { id: "gold", name: "Gold pack", from: 20, odds: [0.4, 0.4, 0.14, 0.045, 0.012, 0.003] },
] as const;
export type PackId = (typeof PACKS)[number]["id"];
export const CARDS_PER_PACK = 3;
/** Stop below this, or go over 21, and the run earns nothing. */
export const RUN_TARGET = 16;

/** The pack a final run total earns, or null. */
export function packFor(total: number): (typeof PACKS)[number] | null {
  const t = roundValue(total);
  if (t < RUN_TARGET || t > 21) return null;
  return [...PACKS].reverse().find((p) => t >= p.from) ?? null;
}

/** One card's tier, from a uniform draw in [0, 1). */
export function tierFor(packId: PackId, u: number): (typeof TIERS)[number] {
  const odds = PACKS.find((p) => p.id === packId)!.odds;
  let edge = 0;
  for (const [i, p] of odds.entries()) {
    edge += p;
    if (u < edge) return TIERS[i]!;
  }
  return TIERS[0];
}

/** What a pack is worth on average if every card is sold back, in chips. */
export function packValue(packId: PackId): number {
  const odds = PACKS.find((p) => p.id === packId)!.odds;
  return CARDS_PER_PACK * odds.reduce((sum, p, i) => sum + p * TIERS[i]!.chips, 0);
}
