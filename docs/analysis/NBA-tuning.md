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
