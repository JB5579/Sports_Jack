// Watch a real game replay through the feed and scorer, play by play.
//   npm run replay -- 2025_22_SEA_NE --speed 120 --qtr 4
//   npm run replay -- fixtures/nflverse/games/2026_07_NE_CHI.csv --speed Infinity
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadNflverseGame, ReplaySource } from "../packages/feed/src/index.ts";
import { QuarterScorer } from "../packages/engine/src/index.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { speed: { type: "string", default: "60" }, qtr: { type: "string", default: "1" }, top: { type: "string", default: "6" } },
});
const target = positionals[0] ?? "2025_22_SEA_NE";
const path = existsSync(target) ? target : `fixtures/nflverse/games/${target}.csv`;
const recorded = loadNflverseGame(path);
const scorer = new QuarterScorer();
const names = new Map<string, string>();
const { game } = recorded;
console.log(`${game.away} @ ${game.home} · ${game.date} · week ${game.week} · scoring ${scorer.rules.id}\n`);

for await (const event of new ReplaySource(recorded, { speed: Number(values.speed), fromQuarter: Number(values.qtr) }).events()) {
  scorer.apply(event);
  const head = `Q${event.clock.qtr} ${event.clock.display}  ${game.away} ${event.score.away}-${event.score.home} ${game.home}`;
  if (event.kind !== "play") {
    console.log(`\n${head}  == ${event.kind.replace("_", " ").toUpperCase()} ==`);
    const leaders = [...scorer.quarter(event.clock.qtr)].sort((a, b) => b[1] - a[1]).slice(0, Number(values.top));
    console.log(`   quarter leaders: ${leaders.map(([id, pts]) => `${names.get(id) ?? id} ${pts}`).join(" · ")}\n`);
    continue;
  }
  const moves = event.deltas.map((d) => {
    names.set(d.playerId, d.name);
    return `${d.name} → ${scorer.points(event.clock.qtr, d.playerId)}`;
  });
  console.log(`${head}  ${event.description.slice(0, 90)}${moves.length ? `\n${" ".repeat(head.length + 2)}▸ ${moves.join(", ")}` : ""}`);
}
