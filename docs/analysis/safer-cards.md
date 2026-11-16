# Safer cards: what they are worth and what they cost

**Date:** 2026-11-16 · **For:** variation B (MVP requirements: "safer options per card") ·
**Script:** `tools/analysis/safer_cards.ts` · **Data:** the 2025 NFL season (nflverse
play-by-play, `sportsjack-v1`) and the 2025-26 NBA season (sportsdataverse, `nba-v2`)

## Result

**A safer card counts its player's live points at half weight. Every safer card in a winning
hand cuts the winnings by 10%.** At that price, no way of using safer cards that we simulated
beats the standard game in either sport, while a cautious player busts less often.

Without a price, safer cards are a free edge: making every card safer and hitting two cards
higher raises the expected result by about 23 cents per chip of ante in the NFL and 11 in the
NBA. The break-even cut for that strategy is about 7% per card, so 10% keeps a margin.

| Sport | Standard: bust, win | Safer on the last hit: bust, win | Expected result per chip, standard → safer on the last hit at 10% |
|---|---|---|---|
| NFL | 18%, 49% | 15%, 50% | +0.003 → −0.034 |
| NBA | 13%, 54% | 8%, 54% | +0.086 → +0.034 |

## How it was simulated

- Each hand is a real quarter: its deck, every card's projection from earlier games only, and
  every player's real points that quarter.
- The player hits at the deal until the face total reaches 15 (NFL) or 13 (NBA), the tuning
  targets, choosing standard or safer for each card as it is dealt. The dealer hits at the deal
  to a face of 15, an approximation of the easy dealer that ignores its live decisions.
- Four ways to play: all standard; safer only on the hit that reaches the target; every card
  safer; every card safer while hitting two higher.
- Expected result: a win pays 1 minus 10% per safer card in the hand, a push 0, a loss −1.

The absolute numbers flatter the player because the simulated dealer is weaker than the real
one, which reacts to live values. The comparison between rows is what sets the price.

NFL decks are every player the play-by-play credits in the game, topped up with never-scoring
cards to a 92-player roster; the app's deck is the nflverse weekly roster.

## Full results

## NFL 2025 (sportsjack-v1, face 2 + 2 × proj, live × 0.5): 948 quarters, hit to face 15, 60000 hands per row
| Damping d | Strategy | Cards | Bust | Win | Push | Safer cards per win | EV, cut 0% | EV, cut 10% | EV, cut 15% | EV, cut 20% | EV, cut 25% | EV, cut 30% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| — | standard | 4.8 | 18% | 49% | 2% | 0.0 | 0.003 |  |  |  |  |  |
| 0.5 | safer on the last hit | 4.8 | 15% | 50% | 1% | 1.0 | 0.017 | -0.034 | -0.059 | -0.084 | -0.109 | -0.134 |
| 0.5 | all safer | 4.8 | 10% | 48% | 1% | 4.8 | -0.022 | -0.252 | -0.366 | -0.451 | -0.487 | -0.497 |
| 0.5 | all safer, hit 2 higher | 5.4 | 24% | 61% | 1% | 5.4 | 0.231 | -0.097 | -0.254 | -0.344 | -0.372 | -0.377 |
| 0.25 | safer on the last hit | 4.8 | 13% | 50% | 1% | 1.0 | 0.018 | -0.033 | -0.058 | -0.083 | -0.108 | -0.133 |
| 0.25 | all safer | 4.8 | 7% | 45% | 1% | 4.8 | -0.089 | -0.305 | -0.412 | -0.491 | -0.524 | -0.533 |
| 0.25 | all safer, hit 2 higher | 5.4 | 18% | 63% | 0% | 5.4 | 0.254 | -0.081 | -0.240 | -0.332 | -0.361 | -0.367 |

## NBA 2025-26 (nba-v2, face 2 + 0.25 × proj, live × 0.2): 4556 quarters, hit to face 13, 60000 hands per row
| Damping d | Strategy | Cards | Bust | Win | Push | Safer cards per win | EV, cut 0% | EV, cut 10% | EV, cut 15% | EV, cut 20% | EV, cut 25% | EV, cut 30% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| — | standard | 4.6 | 13% | 54% | 0% | 0.0 | 0.086 |  |  |  |  |  |
| 0.5 | safer on the last hit | 4.6 | 8% | 54% | 0% | 1.0 | 0.088 | 0.034 | 0.006 | -0.021 | -0.048 | -0.075 |
| 0.5 | all safer | 4.6 | 0% | 48% | 0% | 4.7 | -0.038 | -0.263 | -0.375 | -0.481 | -0.517 | -0.518 |
| 0.5 | all safer, hit 2 higher | 5.3 | 7% | 60% | 0% | 5.3 | 0.199 | -0.120 | -0.278 | -0.391 | -0.399 | -0.399 |
| 0.25 | safer on the last hit | 4.6 | 6% | 54% | 0% | 1.0 | 0.074 | 0.021 | -0.006 | -0.033 | -0.060 | -0.087 |
| 0.25 | all safer | 4.6 | 0% | 45% | 0% | 4.7 | -0.091 | -0.303 | -0.409 | -0.509 | -0.544 | -0.545 |
| 0.25 | all safer, hit 2 higher | 5.3 | 0% | 53% | 0% | 5.3 | 0.061 | -0.222 | -0.362 | -0.461 | -0.469 | -0.469 |

## The rule as built

- A card can be made safer until its player first scores in the hand: the opening cards
  before the action starts, and a drawn card if he hasn't scored yet this quarter. A safer
  card can't be made standard again.
- Its value is face + live points × the ruleset's live weight × 0.5.
- At the whistle, each safer card in a winning hand cuts the profit by 10% (rounded down to
  whole chips): even money against the dealer, the winner's share of the pot after rake, or a
  free-contest prize. What is cut stays with the house or the sponsor.
- Rulesets `alpha-2` (NFL) and `alpha-nba-3` (NBA) carry the safer-card settings. Only players
  on variation B are offered safer cards; everyone else plays exactly as before.
