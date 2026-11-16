import { createHash } from "node:crypto";

/**
 * Referrals and the rewards track (variation A, MVP requirements 2026-11-16). All rewards
 * are play-money chips paid from `house:promotions` through the ledger, so what promotions
 * cost is one account balance.
 */

/** Paid to both the friend and whoever invited them once the friend settles a first real hand: half a starting stack. */
export const REFERRAL_BONUS = 500;

/** Hands played (settled, not practice) and what reaching each pays. */
export const MILESTONES: readonly { hands: number; chips: number }[] = [
  { hands: 1, chips: 100 },
  { hands: 4, chips: 250 },
  { hands: 10, chips: 500 },
  { hands: 25, chips: 1000 },
  { hands: 50, chips: 2500 },
];

/** Playing all four quarters of one game at one table. */
export const FULL_GAME_BONUS = 250;

export const PROMOTIONS = "house:promotions";

export interface Reward {
  kind: "referral" | "milestone" | "full_game";
  label: string;
  chips: number;
}

// No 0/O or 1/I, so a code read aloud or typed from a screenshot comes out right.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A player's own referral code: six characters from their account id, the same every time. */
export function referralCode(accountId: string): string {
  const bytes = createHash("sha256").update(`sportsjack-referral:${accountId}`).digest();
  return Array.from(bytes.subarray(0, 6), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Codes are case-insensitive. A creator code is 3–20 letters, digits or dashes. */
export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const validCreatorCode = (code: string) => /^[A-Z0-9-]{3,20}$/.test(code);
