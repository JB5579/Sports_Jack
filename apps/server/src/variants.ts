import { createHash } from "node:crypto";

/**
 * Variant switches (prd/FOUNDATION.md §4): named settings that let versions of the game run
 * side by side and be compared on the same numbers. A player-scoped switch is assigned to
 * each account once and kept; a table-scoped switch is set for the whole server. Every
 * usage event and every settled hand records the player's switches.
 *
 * A switch may change a contest setting, a ruleset choice or a screen. It may never change
 * a MISSION.md invariant, so none of these switches touch money, the server's authority,
 * logging or how draws are seeded.
 */
export interface SwitchDef {
  name: string;
  scope: "player" | "table";
  values: readonly string[];
  /** The value everyone gets when the owner has set no weights. */
  default: string;
  description: string;
}

export const SWITCHES: readonly SwitchDef[] = [
  {
    name: "variation", scope: "player", values: ["A", "B", "C"], default: "A",
    description: "The MVP prototype variation a player sees: A core + rewards, B safer cards, C collect. B adds safer cards (docs/analysis/safer-cards.md). C adds hit for a pack and collectible cards (prd/FOUNDATION.md).",
  },
  {
    name: "rewards", scope: "player", values: ["on", "off"], default: "on",
    description: "Whether the player has the rewards track (milestone and full-game chips). Referral bonuses apply either way.",
  },
  {
    name: "free_contest_deal", scope: "table", values: ["shared", "own"], default: "shared",
    description: "Whether the free quarter contest deals everyone the same cards, or each player their own.",
  },
];

/** For each switch, each value's share of players. Values left out get none. */
export type Weights = Record<string, Record<string, number>>;

export const switchDef = (name: string): SwitchDef | undefined => SWITCHES.find((s) => s.name === name);

/**
 * Read the owner's weights from `SPORTSJACK_VARIANTS`, for example
 * `variation=A:50,B:50;free_contest_deal=own`. A value with no weight counts 1. Unknown
 * switches or values are refused, so a typo cannot silently send everyone to the default.
 */
export function parseVariants(text: string | undefined): Weights {
  const weights: Weights = {};
  for (const part of (text ?? "").split(";").map((p) => p.trim()).filter(Boolean)) {
    const [name, list] = part.split("=").map((s) => s.trim());
    const def = switchDef(name ?? "");
    if (!def || !list) throw new Error(`SPORTSJACK_VARIANTS: unknown switch in "${part}"`);
    const shares: Record<string, number> = {};
    for (const item of list.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [value, weight] = item.split(":").map((s) => s.trim());
      const w = weight === undefined ? 1 : Number(weight);
      if (!def.values.includes(value ?? "") || !(w >= 0)) throw new Error(`SPORTSJACK_VARIANTS: bad value "${item}" for ${def.name}`);
      shares[value!] = w;
    }
    if (!Object.values(shares).some((w) => w > 0)) throw new Error(`SPORTSJACK_VARIANTS: ${def.name} needs a value with weight above 0`);
    weights[def.name] = shares;
  }
  return weights;
}

/**
 * The value a player falls into: a stable hash of the switch and the account, placed
 * against the weights. The same account always lands in the same place for a switch, and
 * different switches split players independently.
 */
export function bucket(accountId: string, def: SwitchDef, weights: Weights): string {
  const shares = weights[def.name];
  if (!shares) return def.default;
  const total = Object.values(shares).reduce((sum, w) => sum + w, 0);
  const point = (parseInt(createHash("sha256").update(`${def.name}:${accountId}`).digest("hex").slice(0, 8), 16) / 2 ** 32) * total;
  let edge = 0;
  for (const value of def.values) {
    edge += shares[value] ?? 0;
    if (point < edge) return value;
  }
  return def.values.findLast((v) => (shares[v] ?? 0) > 0)!;
}

/** A table-scoped switch's value for the whole server: the heaviest weighted value, or the default. */
export function tableValue(name: string, weights: Weights): string {
  const def = switchDef(name);
  if (!def || def.scope !== "table") throw new Error(`${name} is not a table switch`);
  const shares = weights[name];
  if (!shares) return def.default;
  return def.values.reduce((best, v) => ((shares[v] ?? 0) > (shares[best] ?? 0) ? v : best), def.values[0]!);
}
