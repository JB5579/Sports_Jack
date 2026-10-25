# D1: score-to-21 normalization, tested on real games

**Date:** 2026-10-25 · **Data:** every regular- and post-season quarter of the 2025 NFL
season (285 games, 48,771 plays) from nflverse · **Script:**
`tools/analysis/d1_normalization.py`

The PRD calls this "the single most important unresolved mechanic" and recommends
a season-tuned multiplier (D1). On real data that recommendation does not work.

## What real quarters look like

Deck proxy: the 11 most-involved offensive players per team in each game (~19–22
cards, PRD D2). Scoring: PRD §4.1.

| Per card, per quarter | Value |
|---|---|
| Mean | 2.0 pts |
| Median | 0.7 pts |
| 90th percentile | 6.4 pts |
| 99th percentile | 13.9 pts |
| Cards scoring exactly 0 | **42%** |

Points come in lumps. Most cards do nothing in a given quarter, and one touchdown
(+6) is worth more than a typical card's whole quarter.

## Option (a), one multiplier: never lands near 21

| Hand | Multiplier | In 17–21 | Over 21 |
|---|---|---|---|
| 2 cards | 1× (raw) | 1.3% | 0.6% |
| 2 cards | 2.5× | 6.5% | 15% |
| 2 cards | 4× | 6.2% | 29% |
| 3 cards | 2.5× | 8.6% | 27% |

Scaling up keeps the same shape. The share of hands that end near 21 stays at 6–9%
whatever the multiplier; a bigger multiplier only turns "nobody gets close" into
"everybody busts". Blackjack tension needs most hands to sit in a band where one
more card might help or hurt. A scaled version of this distribution never has that.

## A better shape: face value + live points

Give each card a **face value of 2–10 at the deal**, like a blackjack card, taken
from the player's pre-game projection rank within the game's deck. Then **add the
live quarter points** on top.

| Hand | Live points × | Median | In 17–21 | Over 21 |
|---|---|---|---|---|
| 2 cards (the deal) | 0.5 | 14.1 | 19.5% | 8% |
| 2 cards | 1.0 | 15.5 | 19.9% | 21% |
| 3 cards (one Hit) | 0.5 | 21.3 | 28% | 52% |

The opening two cards land around 14–15, close to casino blackjack's opening total
(about 13–14). From there, Hit is a real decision. Live points still decide the
hand, and a TD still swings it, but it moves a hand that is already in play.

**Caveat:** the face values here are ranked by the player's whole-season average,
which looks ahead. A real build ranks by a pre-game projection (for example,
average over previous weeks). Re-run the simulation once that exists.

## Proposed default for the factory

Build against **face value (2–10 by pre-game projection rank in the deck) + live
points × 0.5**, recorded as an assumption. MISSION.md Q1 keeps the final choice
open for the owner. This changes PRD §4.1's "card value = live fantasy points" and
needs the owner's sign-off before real money.
