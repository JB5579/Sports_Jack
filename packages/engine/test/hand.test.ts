import { describe, expect, it } from "vitest";
import { ActionRefused, faceValue, Hand, shortName } from "../src/index.ts";
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

describe("the shared deal", () => {
  const pool = (seed: number) => {
    const { deck } = realGame("2025_22_SEA_NE");
    return new Hand({ gameId: "2025_22_SEA_NE", qtr: 1, periodStart: 900, lockout: 0, ante: 0, mode: "players",
      deck, seats: ["ann", "bob", "cat"], seed, deal: "shared" });
  };

  it("deals every seat the same two cards", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const hand = pool(seed);
      expect(hand.cards("bob")).toEqual(hand.cards("ann"));
      expect(hand.cards("cat")).toEqual(hand.cards("ann"));
      expect(new Set(hand.cards("ann")).size).toBe(2);
    }
  });

  it("gives the same card to the same move, whenever each seat makes it", () => {
    const hand = pool(11);
    const first = hand.hit("ann");
    hand.hit("ann");
    expect(hand.hit("bob")).toBe(first);
    const burnedFor = hand.burn("cat", hand.cards("cat")[0]!);
    const twin = pool(11);
    expect(twin.burn("ann", twin.cards("ann")[0]!)).toBe(burnedFor);
  });

  it("leaves the ordinary deal as it was", () => {
    const { hand } = dealerHand("2025_22_SEA_NE", 1, { seed: 7 });
    const { hand: again } = dealerHand("2025_22_SEA_NE", 1, { seed: 7, deal: "own" });
    expect(again.cards("you")).toEqual(hand.cards("you"));
    expect(again.cards("dealer")).toEqual(hand.cards("dealer"));
    expect(hand.cards("dealer")).not.toEqual(hand.cards("you"));
  });
});

describe("injuries and void hands (MVP edge-case rules)", () => {
  // Chicago at New England, 2026: Cole Kmet "was injured during the play" with 5:46 left in Q4.
  const KMET_PLAY = "CHI-85-C.Kmet was injured";
  const kmetHand = (seats: Record<string, string[]>) => {
    const { events, deck } = realGame("2026_07_NE_CHI");
    const kmet = deck.find((c) => c.team === "CHI" && shortName(c.name) === "C.Kmet")!;
    const hand = new Hand({ gameId: "2026_07_NE_CHI", qtr: 4, periodStart: 900, lockout: 0, ante: 25, mode: "players",
      deck, seats: Object.keys(seats), seed: 3 });
    return { hand, events, kmet };
  };

  it("names players the way play-by-play does", () => {
    expect(shortName("Kenneth Walker III")).toBe("K.Walker");
    expect(shortName("Cole Kmet")).toBe("C.Kmet");
    expect(shortName("Amon-Ra St. Brown")).toBe("A.St. Brown");
  });

  it("keeps an injured player's value, gives his holder a Burn, and never deals him again", () => {
    const { hand, events, kmet } = kmetHand({ a: [], b: [] });
    const holder = ["a", "b"].find((s) => hand.cards(s).includes(kmet.playerId));
    const injuryPlay = playUntil(hand, events, isPlay(KMET_PLAY));
    const before = hand.points(kmet.playerId);
    hand.apply(injuryPlay);
    expect(hand.injured(kmet.playerId)).toBe(true);
    expect(hand.injuries).toHaveLength(1);
    expect(hand.injuries[0]!.clock).toBe(346);
    const fixed = hand.points(kmet.playerId);
    expect(fixed).toBeGreaterThanOrEqual(before); // his 8-yard catch on that play counts
    for (const e of events) hand.apply(e);
    expect(hand.points(kmet.playerId)).toBe(fixed);
    if (holder) expect(hand.burnsLeft(holder)).toBe(2);
    for (const s of ["a", "b"].filter((x) => x !== holder)) expect(hand.burnsLeft(s)).toBe(1);
  });

  it("gives the free Burn to whoever holds him when he goes down", () => {
    // Find a seed that deals Kmet to the first seat, then play to his injury.
    const { events, deck } = realGame("2026_07_NE_CHI");
    const kmet = deck.find((c) => c.team === "CHI" && shortName(c.name) === "C.Kmet")!;
    let hand: Hand | null = null;
    for (let seed = 1; seed < 5000 && !hand; seed++) {
      const h = new Hand({ gameId: "2026_07_NE_CHI", qtr: 4, periodStart: 900, lockout: 0, ante: 25, mode: "players", deck, seats: ["a", "b"], seed });
      if (h.cards("a").includes(kmet.playerId) && !h.cards("b").includes(kmet.playerId)) hand = h;
    }
    expect(hand).not.toBeNull();
    hand!.apply(playUntil(hand!, events, isPlay(KMET_PLAY)));
    expect([hand!.burnsLeft("a"), hand!.burnsLeft("b")]).toEqual([2, 1]);
    hand!.burn("a", kmet.playerId);
    hand!.burn("a", hand!.cards("a")[1]!);
    expect(() => hand!.burn("a", hand!.cards("a")[0]!)).toThrow(ActionRefused);
    for (let i = 0; i < 40; i++) hand!.hit("b");
    expect(hand!.cards("b")).not.toContain(kmet.playerId);
  });

  it("voids a hand: it ends without a result and never settles", () => {
    const { hand } = kmetHand({ a: [], b: [] });
    hand.void("game suspended");
    expect(hand.over).toBe(true);
    expect(hand.voided).toBe("game suspended");
    expect(() => hand.settle()).toThrow(/void/);
    expect(() => hand.hit("a")).toThrow(ActionRefused);
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
