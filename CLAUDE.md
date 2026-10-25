# SportsJack

Live blackjack where the cards are NFL players and their values move with real
plays. Read `MISSION.md` (scope, invariants, open questions), then
`engineering.md` (stack and conventions). The release being built is
`prd/PHASE1-ALPHA.md`; the full product is `prd/SportsJack-PRD.html`.

- Checks: `python harness/ci.py` (typecheck + tests). Run before every commit.
- Real-game data: `fixtures/nflverse/`; add games with `npm run fixtures -- --games <id>`.
- Watch a real game replay: `npm run replay -- 2025_22_SEA_NE --speed 120 --qtr 4`.
- This repo is built by the AI Software Factory (Archon SDLC workflows). See
  `docs/FACTORY_SETUP.md`. Do not edit `MISSION.md`, `harness/`, `.factory/`,
  `factory/` or the fixtures as part of feature work.
