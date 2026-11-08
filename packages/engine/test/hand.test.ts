import { describe, expect, it } from "vitest";
import { ActionRefused, faceValue, Hand } from "../src/index.ts";
import { dealerHand, isPlay, playUntil, realGame } from "./game.ts";

const HOLLINS = "00-0033555";
const MAYE = "00-0039851";
const TD = "D.Maye pass deep left to 13-M.Hollins for 35 yards, TOUCHDOWN";

describe("the deck and the deal", () => {
  it("is the 96-player game-day roster with face values from pre-game projections", () => {
    const { deck } = realGame("2025_22_SEA_NE");
    expect(deck).toHaveLength(96);
    for (const card of deck) {
      expect(card.face).toBe(faceValue(card.projection));
      expect(card.face).toBeGreaterThanOrEqual(2);
      expect(card.face).toBeLessThanOrEqual(10);
    }
    expect(deck.find((c) => c.playerId === MAYE)!.face).toBe(10);
    expect(deck.filter((c) => c.face === 2).length).toBeGreaterThan(20);
  });

  it("never deals the same player twice in an opening hand, across many seeds", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { hand } = dealerHand("2025_22_SEA_NE", 1, { seed });
      for (const seat of ["you", "dealer"]) expect(new Set(hand.cards(seat)).size, `seed ${seed}`).toBe(2);
    }
  });

  it("deals two different cards per seat, the same for the same seed", () => {
    const a = dealerHand("2025_22_SEA_NE", 1, { seed: 42 }).hand;
    const b = dealerHand("2025_22_SEA_NE", 1, { seed: 42 }).hand;
    const c = dealerHand("2025_22_SEA_NE", 1, { seed: 43 }).hand;
    expect(a.cards("you")).toHaveLength(2);
    expect(new Set(a.cards("you")).size).toBe(2);
    expect(a.cards("you")).toEqual(b.cards("you"));
    expect([...a.cards("you"), ...a.cards("dealer")]).not.toEqual([...c.cards("you"), ...c.cards("dealer")]);
  });
});

describe("live values on real plays", () => {
  it("moves the scorer's card by half his points on Maye's 35-yard TD to Hollins", () => {
    const { hand, events } = dealerHand("2025_22_SEA_NE", 4);
    const td = playUntil(hand, events, isPlay(TD));
    const before = hand.value(HOLLINS);
    expect(before).toBe(hand.card(HOLLINS).face + 0.5 * hand.points(HOLLINS));
    hand.apply(td);
    expect(hand.value(HOLLINS) - before).toBeCloseTo(0.5 * (1 + 3.5 + 6));
    expect(hand.log.at(-1)).toMatchObject({ playerId: HOLLINS, points: 10.5, clock: 753 });
  });

  it("keeps the total equal to the sum of the cards, and logs every change", () => {
    const { hand, events } = dealerHand("2025_22_SEA_NE", 2, { seed: 3 });
    for (const e of events) {
      hand.apply(e);
      const sum = hand.cards("you").reduce((s, c) => s + hand.value(c), 0);
      expect(hand.total("you")).toBeCloseTo(sum, 6);
    }
    expect(hand.over).toBe(true);
    expect(hand.log.length).toBeGreaterThan(20);
    expect(hand.log.every((c) => c.points !== 0 && c.playId)).toBe(true);
  });

  it("starts every quarter from face values: points do not carry over", () => {
    const { hand, events } = dealerHand("2025_22_SEA_NE", 2);
    playUntil(hand, events, (e) => e.clock.qtr === 2);
    for (const c of hand.cards("you")) expect(hand.value(c)).toBe(hand.card(c).face);
  });
});

describe("Hit, Burn and Freeze", () => {
  it("hits as often as you like, never drawing a player already in the hand", () => {
    const { hand } = dealerHand("2025_21_LA_SEA", 1);
    for (let i = 0; i < 12; i++) hand.hit("you");
    expect(hand.cards("you")).toHaveLength(14);
    expect(new Set(hand.cards("you")).size).toBe(14);
  });

  it("burns once, before Freeze, for a card from the same game not already held", () => {
    const { hand, deck } = dealerHand("2025_21_LA_SEA", 1);
    const [first] = hand.cards("you");
    const replacement = hand.burn("you", first!);
    expect(replacement).not.toBe(first);
    expect(hand.cards("you")).toContain(replacement);
    expect(hand.cards("you")).not.toContain(first);
    expect(deck.some((c) => c.playerId === replacement)).toBe(true);
    expect(() => hand.burn("you", replacement)).toThrow(ActionRefused);
    expect(() => hand.burn("you", "00-0000000")).toThrow(/burn_used/);
  });

  it("freezes the total while the cards keep moving, and refuses every action after", () => {
    const { hand, events } = dealerHand("2025_22_SEA_NE", 4, { seed: 11 });
    playUntil(hand, events, (e) => e.clock.qtr === 4 && e.clock.quarterSecondsRemaining < 800);
    while (!hand.cards("you").includes(HOLLINS) && hand.cards("you").length < 96) hand.hit("you");
    const locked = hand.freeze("you");
    for (const e of events) hand.apply(e);
    expect(hand.total("you")).toBe(locked);
    const live = hand.cards("you").reduce((s, c) => s + hand.value(c), 0);
    expect(live).not.toBeCloseTo(locked, 3);
    expect(() => hand.hit("you")).toThrow(ActionRefused);
  });

  it("closes actions at the lockout while values keep moving to the whistle", () => {
    const { hand, events } = dealerHand("2025_22_SEA_NE", 4, { lockout: 120 });
    playUntil(hand, events, isPlay("D.Maye pass short left to 38-R.Stevenson for 7 yards, TOUCHDOWN"));
    expect(hand.clock).toBe(152); // the play before Stevenson's 2:28 touchdown
    hand.advanceClock(119);
    expect(hand.locked).toBe(true);
    expect(() => hand.hit("you")).toThrow(/locked/);
    const before = hand.points("00-0036875");
    hand.apply(events.find(isPlay("D.Maye pass short left to 38-R.Stevenson for 7 yards, TOUCHDOWN"))!);
    expect(hand.points("00-0036875")).toBeGreaterThan(before);
  });
});

describe("the whistle", () => {
  it("ends a quarter at its END QUARTER event and ignores later plays", () => {
    const { hand, events } = dealerHand("2026_07_NE_CHI", 1);
    for (const e of events) hand.apply(e);
    expect(hand.over).toBe(true);
    expect(hand.clock).toBe(0);
    expect(hand.log.every((c) => events.find((e) => e.kind === "play" && e.playId === c.playId)!.clock.qtr === 1)).toBe(true);
  });

  it("ends the overtime bonus hand on SEA's winning score with 3:13 left", () => {
    const { hand, events } = dealerHand("2025_16_LA_SEA", 5);
    for (const e of events) hand.apply(e);
    expect(hand.over).toBe(true);
    expect(hand.clock).toBe(193);
  });

  it("runs a tied overtime to 0:00", () => {
    const { hand, events } = dealerHand("2025_04_GB_DAL", 5);
    for (const e of events) hand.apply(e);
    expect(hand.over).toBe(true);
    expect(hand.clock).toBe(0);
  });

  it("refuses to settle a live hand", () => {
    expect(() => dealerHand("2025_22_SEA_NE", 1).hand.settle()).toThrow(/still live/);
  });

  it("conserves yards at a player table: payouts plus the house equal the pot", () => {
    const { events, deck } = realGame("2025_21_LA_SEA");
    for (let seed = 1; seed <= 20; seed++) {
      const hand = new Hand({ gameId: "2025_21_LA_SEA", qtr: 3, periodStart: 900, lockout: 60, ante: 100,
        mode: "players", deck, seats: ["a", "b", "c", "d"], seed });
      for (const e of events) hand.apply(e);
      const s = hand.settle();
      expect(s.standings.reduce((sum, x) => sum + x.payout, 0) + s.house).toBe(s.pot);
      expect(s.house).toBeGreaterThanOrEqual(40);
      expect(s.standings[0]!.payout).toBeGreaterThan(0);
    }
  });
});
