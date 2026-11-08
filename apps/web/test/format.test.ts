import { describe, expect, it } from "vitest";
import { clockText, playText, qName, shortName, statLine, versus } from "../src/format.ts";

describe("phone formatting", () => {
  it("shows the game clock and quarter the way the broadcast does", () => {
    expect(clockText(753)).toBe("12:33");
    expect(clockText(0.4)).toBe("0:01");
    expect(qName(4)).toBe("Q4");
    expect(qName(5)).toBe("OT");
    expect(qName(6)).toBe("2OT");
  });

  it("strips the clock and formation notes from real play text", () => {
    expect(playText("(12:33) (No Huddle, Shotgun) 10-D.Maye pass deep left to 13-M.Hollins for 35 yards, TOUCHDOWN."))
      .toBe("10-D.Maye pass deep left to 13-M.Hollins for 35 yards, TOUCHDOWN.");
    expect(playText("(:16) (Shotgun) 10-D.Maye sacked at NE 37")).toBe("10-D.Maye sacked at NE 37");
  });

  it("writes stat lines for offense and defense", () => {
    expect(statLine({ rec: 1, recYds: 35, recTd: 1 })).toBe("1 rec, 35 yds, 1 TD");
    expect(statLine({ soloTkl: 1, sack: 1, ff: 1 })).toBe("1 tackle · 1 sack · 1 forced fumble");
    expect(statLine({})).toBe("No stats yet this quarter");
    expect(statLine({ pts: 8, fg3m: 2, reb: 3, ast: 1, tov: 1 })).toBe("8 pts (2 threes) · 3 reb · 1 ast · 1 turnover");
    expect(shortName("Jaxon Smith-Njigba")).toBe("J. Smith-Njigba");
  });
});

describe("you versus the dealer", () => {
  it("says who is ahead in the terms that decide the hand", () => {
    expect(versus(18.5, 16)).toBe("You lead the dealer by 2.5");
    expect(versus(15, 19.3)).toBe("Dealer leads by 4.3");
    expect(versus(19, 23)).toBe("Dealer is over 21 · stay at 21 or under to win");
    expect(versus(22.5, 18)).toBe("You're over 21 · dealer has 18.0");
    expect(versus(22, 24)).toBe("Both over 21 · you're closer, by 2.0");
    expect(versus(20, 20)).toBe("Even with the dealer");
  });
});
