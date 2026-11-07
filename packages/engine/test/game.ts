import { loadNflverseGame, loadNflversePlayers, loadProjections, type FeedEvent } from "@sportsjack/feed";
import { buildDeck, Hand, type HandOptions } from "../src/index.ts";
import { gamePath, projectionsPath, rosterPath } from "../../feed/test/fixtures.ts";

/** A real recorded game, ready to deal: its events and its game-day roster deck. */
export function realGame(gameId: string) {
  const { events } = loadNflverseGame(gamePath(gameId));
  const deck = buildDeck(loadNflversePlayers(rosterPath(gameId)), loadProjections(projectionsPath(gameId)));
  return { events, deck };
}

export function dealerHand(gameId: string, qtr: number, extra: Partial<HandOptions> = {}) {
  const { events, deck } = realGame(gameId);
  const hand = new Hand({
    gameId, qtr, periodStart: qtr === 5 ? 600 : 900, lockout: 0, ante: 25, mode: "dealer",
    deck, seats: ["you", "dealer"], dealerSeat: "dealer", seed: 7, ...extra,
  });
  return { hand, events, deck };
}

/** Feed events up to (not including) the first that matches. */
export function playUntil(hand: Hand, events: FeedEvent[], stop: (e: FeedEvent) => boolean): FeedEvent {
  for (const e of events) {
    if (stop(e)) return e;
    hand.apply(e);
  }
  throw new Error("stop event not found");
}

export const isPlay = (text: string) => (e: FeedEvent) => e.kind === "play" && e.description.includes(text);
