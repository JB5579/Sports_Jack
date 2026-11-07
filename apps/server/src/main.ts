// SportsJack server: node --experimental-strip-types apps/server/src/main.ts
import { configFromEnv } from "./config.ts";
import { createSportsJackServer } from "./server.ts";

const config = configFromEnv();
const server = createSportsJackServer(config);
const port = await server.listen();
console.log(`SportsJack listening on http://localhost:${port} · replaying ${config.games.join(", ")} at ${config.speed}x · db ${config.db}`);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void server.close().then(() => process.exit(0)));
