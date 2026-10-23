# SportsJack

**Live Poker Meets Real-Time Sports.** Play Texas Hold'em where the cards ARE NFL players and their values change in real-time with their fantasy performance. Mobile web MVP, settlement in USDC on Solana. Status: pre-development — high-fidelity prototype and PRD complete.

## Repository Structure

| Path | Contents |
|------|----------|
| `docs/` | Product brief (`.md` + `.docx`), gameplay screen design decisions, session summary, Gameplay v2 design mock |
| `prd/` | Product Requirements Document (`SportsJack-PRD.html`, self-contained) |
| `prototype/` | Interactive React prototype (Blackjack v2). Open `prototype/index.html` in a browser — React/Babel load from CDN |
| `prototype/components/` | Prototype React components (lobby, gameplay, buy-in, wallet, result, playing-card, data) |
| `exports/` | Single-file standalone builds of the prototype and PRD for sharing |
| `screenshots/` | Design captures from the prototyping sessions |
| `design-canvas/` | Design-tool export metadata (canvas state, thumbnail) |

## Notes

- Extracted and organized from the original `Sports_Jack.zip` design-canvas export (the zip is preserved in git history, commit `da52678`, if the raw layout is ever needed).
- Renames during organization: `SportsJack Blackjack v2.html` → `prototype/index.html`; the two `(standalone).html` files → `exports/` with hyphenated names. No file referenced the old names, and `index.html`'s relative references (`styles.css`, `components/*.jsx`, `design-canvas.jsx`, `ios-frame.jsx`, `tweaks-panel.jsx`) were kept intact.
- `uploads/files (2)/` in the original zip was a byte-identical duplicate of `uploads/` (verified via SHA1) and was dropped.
