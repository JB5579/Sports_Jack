# NBA tuning: face values and live weight on real games

**Date:** 2026-11-08 · **Data:** every regular-season and playoff quarter of the
2025-26 NBA season (1,325 games) from sportsdataverse's ESPN play-by-play ·
**Script:** `tools/analysis/nba_tuning.ts` · **Scoring:** `nba-v1` (DraftKings'
classic NBA scoring without double-double bonuses: point 1, three made +0.5,
rebound 1.25, assist 1.5, steal 2, block 2, turnover −0.5)

The NFL settings (face = 2 + 2 × projected quarter points, live × 0.5) don't
carry over. Basketball scores all the time.

| Per card, per quarter | NFL (2025) | NBA (2025-26) |
|---|---|---|
| Median | 0.7 pts | 3.25 pts |
| 90th percentile | 6.4 | 12 |
| Cards scoring 0 | 42% | 34% |

Each deck is the ~25 players dressed for the game. Projections are each player's
average `nba-v1` points per quarter over earlier games only. The simulated player
hits at the deal until the face total reaches a target, then holds.

## Settings tried (hit to face 13)

| Face scale k | Live weight w | Cards | Median | In 17–21 | Over 21 | Live share |
|---|---|---|---|---|---|---|
| 0.25 | 0.15 | 4.6 | 17.2 | 50% | 5% | 18% |
| **0.25** | **0.20** | **4.6** | **18.3** | **56%** | **15%** | **23%** |
| 0.25 | 0.25 | 4.6 | 19.3 | 52% | 28% | 27% |
| 0.50 | 0.10 | 3.5 | 16.3 | 35% | 3% | 10% |
| 0.50 | 0.20 | 3.5 | 17.9 | 49% | 15% | 18% |

With a bigger face scale (0.5–1.0) and a small weight (0.1), hands also land near
21, but plays barely move the cards: a star's 12-point quarter adds 1.2. "Live
share" is the part of the final total that came from plays during the quarter.
SportsJack's point is that values move while you watch, so the chosen setting keeps
that share near a quarter of the total.

## Recorded default (`alpha-nba-1`)

**Face = 2 + 0.25 × projected quarter points, capped 2–10; value = face + live
points × 0.2.** Hitting to a face total of 13 lands 56% of hands in 17–21 with 15%
busts, the same bust rate as the NFL tuning. Hitting to 15 busts 48%, so NBA hands
reward stopping earlier than NFL ones.

## 2026-11-16: turnovers at −1.5 (`nba-v2`, `alpha-nba-2`)

The MVP review set an NBA turnover at −1.5 points (it was −0.5; PrizePicks uses −1).
Everything else in the scoring is unchanged. The same season, re-run with
`tools/analysis/nba_tuning.ts 2026 0.25 0.15,0.2,0.25 13,15 nba-v2`:

| Scoring | Per card median | p90 | Hit to 13: median | In 17–21 | Over 21 | Live share |
|---|---|---|---|---|---|---|
| nba-v1 (k 0.25, w 0.20) | 3.25 | 12 | 18.3 | 55% | 15% | 23% |
| **nba-v2 (k 0.25, w 0.20)** | **3** | **11.5** | **18.1** | **54%** | **14%** | **23%** |
| nba-v2 (k 0.25, w 0.15) | 3 | 11.5 | 17.1 | 48% | 4% | 18% |
| nba-v2 (k 0.25, w 0.25) | 3 | 11.5 | 19.1 | 52% | 26% | 27% |

A turnover is rare enough per quarter that the bigger penalty barely moves where hands
land, so the face scale (0.25) and live weight (0.2) stay. What changes is the swing: a
player who turns it over twice now loses 0.6 of card value instead of 0.2.

The fixture games' projections (`fixtures/nba/projections/`) were computed under nba-v1.
Under nba-v2 a player's projection falls by his turnovers per quarter (about 0.3 for a
typical starter), which moves a face by under 0.1 before rounding, so the fixtures are
left as they are. Regenerate them with `tools/nba/projections.ts` when the next NBA games
are added.
