import { fileURLToPath } from "node:url";

export interface ServerConfig {
  port: number;
  /** SQLite file for accounts, the ledger and hand history. A new path is a fresh state. */
  db: string;
  /** Fixture game ids to replay. */
  games: string[];
  /** Game-clock seconds per real second. */
  speed: number;
  fromQuarter: number;
  /** Real seconds between quarters, when players can join. */
  breakSeconds: number;
  /** Start the replay again when a game ends, so the server always has a live game. */
  loop: boolean;
  /** Expose replay pause/resume so runtime checks can exercise the feed-paused path. */
  testControls: boolean;
  /** "manual" lets tests drive the clock with advance(); "real" runs on a timer. */
  clock: "real" | "manual";
  candidate: string | undefined;
  fixtures: string;
  webRoot: string;
}

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 8787),
    db: env.SPORTSJACK_DB ?? `${ROOT}.cache/sportsjack.sqlite`,
    games: (env.SPORTSJACK_REPLAY ?? "2025_22_SEA_NE,2025_21_LA_SEA,2025_16_LA_SEA").split(",").map((g) => g.trim()).filter(Boolean),
    speed: Number(env.SPORTSJACK_REPLAY_SPEED ?? 6),
    fromQuarter: Number(env.SPORTSJACK_REPLAY_FROM_QUARTER ?? 1),
    breakSeconds: Number(env.SPORTSJACK_BREAK_SECONDS ?? 20),
    loop: env.SPORTSJACK_REPLAY_LOOP !== "0",
    testControls: env.SPORTSJACK_TEST_CONTROLS === "1",
    clock: "real",
    candidate: env.FACTORY_RUNTIME_CANDIDATE || undefined,
    fixtures: `${ROOT}fixtures/nflverse/`,
    webRoot: `${ROOT}apps/web/dist/`,
  };
}
