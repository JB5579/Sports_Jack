# Mission

<!--
  Owner: humans only. This file is on the protected list; the factory cannot edit it.
  When the product changes, this changes in the same commit.
-->

**Derived from:** `prd/SportsJack-PRD.html` (v1.0, June 2026), scoped by
`prd/PHASE1-ALPHA.md` (the release the factory is building now)
**Last reconciled with it:** 2026-10-25

## What SportsJack is

SportsJack is live blackjack where the cards are NFL players. Each quarter of a
real NFL game is one hand. A player antes, is dealt NFL players as cards, and each
card's value moves with that player's fantasy points as the game is played. They
Hit, Stand, or spend a Freeze or Burn power-up, trying to finish the quarter
closest to 21 without going over. They play against a house dealer or up to five
other people at a table. The PRD names the payoff: a reason to make a decision on
every drive of a game you are already watching.

This release is the **Phase 1 play-money alpha** (PRD §17). It runs the full game
loop on **real NFL games replayed from recorded play-by-play** (nflverse), with
play-money yards. There is no wallet, no USDC, no blockchain and no KYC in this
release. There is one deployment, and one authoritative game server per table.

## Who it is for

- A 21–40-year-old sports fan with a phone in hand during a game. They already play
  DFS or bet, and they want a decision to make while the game is on.

SportsJack is not a sportsbook and not daily fantasy. Nobody bets on outcomes or
drafts a lineup. The game is blackjack, and the sport only moves the cards.

## Core capabilities (in scope)

The factory may accept issues in these areas.

**Game feed and scoring**
- A feed interface (`packages/feed`) that delivers a game's plays in order, with
  the nflverse replay source as its first implementation
- Per-quarter fantasy scoring under a versioned ruleset (`packages/engine`)
- A replay clock that runs a real recorded game at a chosen speed
- A visible "live data paused" state when the feed stalls or fails

**Game engine (server-authoritative)**
- Hands per quarter: ante, deal, live card values, Hit, Stand, Freeze, Burn, live
  bust and recovery, end-of-quarter settlement in play-money yards
- The vs-Dealer mode with a deterministic, published dealer policy
- The PvP mode at 6-max tables with a shared pot and a displayed rake
- Draws that can be reproduced from a committed seed
- An audit log: every card-value change records its feed event
- Disconnect and reconnect handling mid-hand

**Client (mobile-first web/PWA)**
- The prototype's lobby, buy-in, gameplay (the 21-dial), showdown and wallet
  screens (`prototype/`), driven by the real server
- A play-money onboarding hand with a guided overlay
- A card detail view: the live stat line behind a card's value
- Empty, error and feed-paused states

**Simulation and tuning**
- Tools that replay real seasons to tune scoring, deck and dealer rules
  (`tools/analysis/`)

## Out of scope -- the factory must never build this

<!-- Proposed by the setup agent from the PRD. The owner strikes the wrong ones. -->

**Not a different gambling product**
- Standalone sportsbook wagers: moneylines, spreads, totals, parlays or player
  props that are not part of a SportsJack hand
- Pre-game drafts, season-long fantasy leagues or DFS-style lineup contests
- Casino games with no live sports link (slots, roulette, plain RNG blackjack)

**Not pay-to-win, not a crypto product**
- Anything purchasable that changes a hand's outcome in real-money PvP: power-ups,
  extra charges, better draws, peeks (PRD §6, §14 guardrail)
- A SportsJack token, NFT cards, staking, or yield and interest on balances
- Transfers or gifting of yards from one user to another

**Not deceptive**
- House bots at a PvP table that are not clearly labeled as bots

## Hard invariants -- not tunable by any issue

These properties define SportsJack. The factory cannot change them, even if an
issue asks nicely, gives a good reason or calls it a bug. Changing one requires a
human commit.

1. **The server decides; clients only render.** Clients send intents (Hit, Stand,
   Freeze, Burn, ante). They never compute or submit a card value, total or
   outcome. All players at a table see a value change on the same server tick.
2. **Never settle on stale or unexplained data.** Every card-value change is
   logged with the feed event that caused it. When the feed stalls, the table
   shows "live data paused" and does not settle until the feed resumes. Settled
   hands are final; they are never re-settled after stat corrections.
3. **This release moves no real money.** No code path in this release touches a
   wallet, USDC, a blockchain, a payment provider or real-money balances. Yards
   are play-money.
4. **Scoring is versioned.** Every hand records the ruleset id it was scored
   under. A change to point values is a new ruleset, never an edit to a used one.
5. **Draws are reproducible.** A hand's draws follow from a seed committed before
   the deal, so a hand can be replayed and audited.
6. **The factory cannot modify governance files.** `MISSION.md`,
   `FACTORY_RULES.md`, `FACTORY.md` and `engineering.md` are the constitution. A
   PR touching any of them is an automatic reject.
7. **The factory cannot modify its own judge.** `harness/`, `.factory/holdout/`
   and the real-game fixtures in `fixtures/nflverse/` define what "working" means
   here. Adding an assertion or a fixture game is always welcome. Removing or
   loosening one is always a human decision.

## Allowed evolutions

These are explicitly in scope, so the factory does not reject them as
architectural drift:

- Adding feed sources behind the `FeedSource` interface, as long as the replay
  source keeps working
- Moving storage from SQLite to PostgreSQL (PRD §10)
- Performance, accessibility (WCAG AA, 48px touch targets) and animation polish
  on the prototype screens

## Definition of done

Every change the factory ships clears all three gates.

**Gate 1 -- static checks and tests pass.** `python harness/ci.py`, which runs
`npm run typecheck` and `npm test` (including the real-game fixture tests).

**Gate 2 -- the rules are visible.** A new or changed rule (scoring, deck, dealer,
tie, bust) is shown to the user in the game's rules screen, and the engine has a
test that uses a real recorded game, not only made-up numbers.

**Gate 3 -- the end-to-end path passes as a real user.** See `harness/END-TO-END.md`.

1. Start the server with a recorded real game set to replay.
2. Open the lobby, pick the replayed game and a vs-Dealer table, and ante.
3. Watch card values change as the game's real plays arrive. Hit or Stand.
4. At the end of the quarter, see the hand settle and the play-money balance
   change by the amount shown on the result screen.

This runs on every change that touches runnable code, including ones that "seem
unrelated". It is not optional.

## Open questions -- decisions nobody has made yet

These are undecided, not forbidden. **The factory may propose an answer to any of
them**, build against it, and record what it assumed. The merge is then held for a
human, so nothing ships on a guess and nothing stops for one.

- **Q1 (PRD D1) How is a card's value scaled to the 21 target?** Proposed: a face
  value of 2–10 at the deal, from the player's pre-game projection rank in the
  deck, plus live quarter points × 0.5. The PRD's single-multiplier idea fails on
  real 2025 data; see `docs/analysis/D1-score-normalization.md`.
- **Q2 (D2) What is the deck?** Proposed: a per-game shared pool of about 22
  skill-position players (QB, RB, WR, TE) from the two teams, non-consuming, with
  draws weighted by projection.
- **Q3 (D3) What does Stand mean?** Proposed: Stand stops drawing, and the cards
  stay live. Freeze locks the number.
- **Q4 (D4) Does Hit cost yards?** Proposed: free; the hand has at most 5 cards,
  and there is no Hit after Stand.
- **Q5 (D5) How do players get power-ups?** Proposed: 1 Freeze + 1 Burn free per
  hand, for everyone.
- **Q6 (D6) What is the dealer's policy?** Proposed: deterministic and published,
  with no power-ups. The exact hit/stand rule comes from simulation on real games.
- **Q7 (D7) How are ties and all-bust hands settled?** Proposed: a tie splits the
  pot; when everyone busts, the hand closest to 21 from above wins.
- **Q8 When does a hand start, and can players join late?** Proposed: deal at
  the quarter's first scrimmage play; no joining after the deal in this release.
- **Q9 Which live provider follows the replay?** ESPN's unofficial JSON (free),
  Sportradar or SportsDataIO (licensed). This is not needed for this release: the
  replay source is the only feed until the owner decides.

**Except these, which do stop the factory.** They are irreversible (see
`FACTORY_RULES.md`) rather than open in the ordinary sense:

- How users sign up and log in, and anything about identity, sessions or who can
  act for whom (play-money accounts included)
- Migrating or deleting stored hand history or balances
- Anything that would move real money (invariant 3): wallet, escrow, USDC, KYC,
  launch jurisdictions (PRD D8, D10)

Once answered, an entry moves to **Decisions** below with its answer and date, and
stops being asked. **A decision is asked once.**

## Decisions

- 2026-10-25 **Which design is canonical?** The blackjack PRD
  (`prd/SportsJack-PRD.html`). The Texas Hold'em product brief in `docs/` is
  superseded and kept for history.
- 2026-10-25 **What is the first release?** The Phase 1 play-money alpha
  (`prd/PHASE1-ALPHA.md`). The PRD's own recommendations for D1–D9 are the
  starting defaults, subject to the questions above.
- 2026-10-25 **Where does game data come from?** Replays of real recorded NFL
  play-by-play from nflverse (CC-BY 4.0). There is no live provider for now.
  Yahoo Sports offers no public live API, so it cannot be the feed.
- 2026-10-25 **How much can a user do before signing up? (D9)** Unlimited
  play-money; only real money (a later release) is gated.

## What the factory does NOT own -- permanently human

- Does a hand FEEL right: the pacing of a quarter, whether Hit is tense, whether
  Freeze and Burn feel worth saving
- Does it LOOK right: the 21-dial, the Vegas feel, whether "busted but
  recoverable" reads differently from "busted for good"
- Is it UNDERSTANDABLE: can a first-time user get "cards are players, values are
  live" from the onboarding hand without being told
- Legal and compliance: jurisdictions, the game-of-skill posture, responsible play

The factory owns the scoring, the deck, the hand state machine, the dealer
policy and settlement: the layer whose correctness can be asserted against real
recorded games. Most of the risk lives there, and that half can be defended. The
list above is reviewed by a human, on purpose, forever.
