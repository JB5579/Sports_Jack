import { describe, expect, it } from "vitest";
import { clockText, playText, qName, shortName, statLine } from "../src/format.ts";

describe("phone formatting", () => {
  it("shows the game clock and quarter the way the broadcast does", () => {
    expect(clockText(753)).toBe("12:33");
    expect(clockText(0.4)).toBe("0:01");
    expect(qName(4)).toBe("Q4");
    expect(qName(5)).toBe("OT");
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
    expect(shortName("Jaxon Smith-Njigba")).toBe("J. Smith-Njigba");
  });
});
