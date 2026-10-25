import { describe, expect, it } from "vitest";
import { loadNflverseGame, ReplaySource, type FeedEvent } from "../src/index.ts";
import { gamePath } from "./fixtures.ts";

async function collect(source: ReplaySource): Promise<FeedEvent[]> {
  const out: FeedEvent[] = [];
  for await (const event of source.events()) out.push(event);
  return out;
}

describe("ReplaySource", () => {
  const recorded = loadNflverseGame(gamePath("2026_07_NE_CHI"));

  it("delivers every recorded event in order when unpaced", async () => {
    expect(await collect(new ReplaySource(recorded))).toEqual(recorded.events);
  });

  it("paces by the game clock: a full game at 60x waits about one minute per quarter", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => void waits.push(ms);
    await collect(new ReplaySource(recorded, { speed: 60, sleep, maxGapMs: Infinity }));
    const totalSeconds = waits.reduce((a, b) => a + b, 0) / 1000;
    expect(totalSeconds).toBeGreaterThan(55);
    expect(totalSeconds).toBeLessThanOrEqual(60.001);
  });

  it("can start at a later quarter", async () => {
    const events = await collect(new ReplaySource(recorded, { fromQuarter: 3 }));
    expect(events[0]!.clock.qtr).toBe(3);
  });
});
