# Engineering conventions

Read `MISSION.md` first: it decides what is in scope. The release being built is
`prd/PHASE1-ALPHA.md`.

## Stack

- TypeScript, strict, on Node 22. An npm workspace: `packages/*` (libraries) and
  `apps/*` (server, web). Run TypeScript directly with
  `node --experimental-strip-types`; there is no compile step for the server.
- Tests: Vitest (`npm test`). Typecheck: `npm run typecheck`. The gate:
  `python harness/ci.py` runs both, as does the `tests` CI job.
- Server (`apps/server`): HTTP + WebSocket. The server is authoritative.
- Web (`apps/web`): React + Vite, mobile-first, porting `prototype/` components.
- Storage: SQLite through `node:sqlite` at `SPORTSJACK_DB`.
- Data tooling: Python 3 standard library (`tools/nflverse/`). Analysis may use
  pandas through `uv run --with pandas`.

## Rules for game code

- Game rules are pure functions in `packages/engine`, with no I/O, clock or
  randomness of their own. Randomness comes from an injected seeded generator.
  Time comes from feed events.
- Everything that reaches the engine arrives through `FeedSource`. Never read
  nflverse files or call a provider from engine or server game logic.
- Every rule change needs a test on a real recorded game from
  `fixtures/nflverse/`, in addition to any unit test with made-up numbers. Need a
  game that shows a case (a fumble, overtime, a two-point conversion)? Add one with
  `npm run fixtures -- --games <game_id>`. Never edit a fixture by hand.
- Scoring rulesets are immutable once used. Add a new id; never change one.
- Money is integer yards. No floats in balances, pots or rake.

See [factory workflow policy](factory/WORKFLOW_POLICY.md) for factory-specific shared-workflow requirements.
