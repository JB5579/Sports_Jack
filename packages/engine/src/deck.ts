import type { Player } from "@sportsjack/feed";
import { ALPHA_RULES, faceValue, type GameRules } from "./rules.ts";

export interface Card {
  playerId: string;
  name: string;
  position: string;
  team: string;
  projection: number;
  face: number;
}

/** The deck is the game-day active roster of both teams (MISSION.md Q2). */
export function buildDeck(roster: Player[], projections: ReadonlyMap<string, number>, rules: GameRules = ALPHA_RULES): Card[] {
  return roster.map((p) => {
    const projection = projections.get(p.playerId) ?? 0;
    return { playerId: p.playerId, name: p.name, position: p.position, team: p.team, projection, face: faceValue(projection, rules) };
  });
}
