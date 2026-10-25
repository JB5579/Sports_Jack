# SportsJack

**Live blackjack where the cards are NFL players.** Each quarter is a hand; card values move with the player's real fantasy points as the game is played. Hit, Stand, Freeze or Burn to finish closest to 21. The canonical design is the PRD (`prd/SportsJack-PRD.html`). The Hold'em product brief in `docs/` is superseded.

**Status:** building the Phase 1 play-money alpha (`prd/PHASE1-ALPHA.md`) on replays of real recorded NFL games, using the AI Software Factory. Start with `MISSION.md`, then `docs/FACTORY_SETUP.md`.

```bash
npm ci
python harness/ci.py                                      # typecheck + tests on real games
npm run replay -- 2025_22_SEA_NE --speed 120 --qtr 4      # watch Super Bowl LX's 4th quarter as cards
```

## Repository Structure

| Path | Contents |
|------|----------|
| `MISSION.md` | Scope, never-build list, invariants, open questions (human-owned) |
| `packages/feed` | `FeedSource` interface, nflverse play-by-play parser, `ReplaySource` |
| `packages/engine` | Game rules; today per-quarter fantasy scoring |
| `fixtures/nflverse/` | Real recorded games (plays, rosters, box scores), CC-BY 4.0 nflverse |
| `tools/` | Fixture fetcher, replay CLI, real-season analyses |
| `harness/`, `factory/`, `.factory/` | AI Software Factory installation (protected) |
| `docs/analysis/` | Evidence for open design decisions (D1 score normalization) |
| `docs/` | Product brief (`.md` + `.docx`), gameplay screen design decisions, session summary, Gameplay v2 design mock |
| `prd/` | Product Requirements Document (`SportsJack-PRD.html`) and this release's scope (`PHASE1-ALPHA.md`) |
| `prototype/` | Interactive React prototype (Blackjack v2). Open `prototype/index.html` in a browser — React/Babel load from CDN |
| `prototype/components/` | Prototype React components (lobby, gameplay, buy-in, wallet, result, playing-card, data) |
| `exports/` | Single-file standalone builds of the prototype and PRD for sharing |
| `screenshots/` | Design captures from the prototyping sessions |
| `design-canvas/` | Design-tool export metadata (canvas state, thumbnail) |

## Notes

- Extracted and organized from the original `Sports_Jack.zip` design-canvas export (the zip is preserved in git history, commit `da52678`, if the raw layout is ever needed).
- Renames during organization: `SportsJack Blackjack v2.html` → `prototype/index.html`; the two `(standalone).html` files → `exports/` with hyphenated names. No file referenced the old names, and `index.html`'s relative references (`styles.css`, `components/*.jsx`, `design-canvas.jsx`, `ios-frame.jsx`, `tweaks-panel.jsx`) were kept intact.
- `uploads/files (2)/` in the original zip was a byte-identical duplicate of `uploads/` (verified via SHA1) and was dropped.
