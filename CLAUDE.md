# SportsJack

Live blackjack where the cards are NFL players and their values move with real
plays. Read `MISSION.md` (scope, invariants, open questions), then
`engineering.md` (stack and conventions). The release being built is
`prd/PHASE1-ALPHA.md`; the full product is `prd/SportsJack-PRD.html`.

- Checks: `python harness/ci.py` (typecheck + tests). Run before every commit.
- Real-game data: `fixtures/nflverse/` (NFL; add games with `npm run fixtures -- --games <id>`) and
  `fixtures/nba/` (NBA; `uv run --with pyarrow tools/nba/fetch_fixtures.py --games <espn id>`, then
  `node --experimental-strip-types tools/nba/projections.ts`).
- Watch a real game replay: `npm run replay -- 2025_22_SEA_NE --speed 120 --qtr 4`.
- Run the game server: `npm start` (port 8787; `PORT`, `SPORTSJACK_DB`, `SPORTSJACK_REPLAY`,
  `SPORTSJACK_REPLAY_SPEED` and `SPORTSJACK_TEST_CONTROLS=1` are in `apps/server/src/config.ts`).
- Phone app: `npm run build:web`, then `npm start` serves it at http://localhost:8787. For hot reload,
  run `npm start` and `npm run dev:web` side by side.
- This repo is built by the AI Software Factory (Archon SDLC workflows). See
  `docs/FACTORY_SETUP.md`. Do not edit `MISSION.md`, `harness/`, `.factory/`,
  `factory/` or the fixtures as part of feature work.
