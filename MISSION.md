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
Hit as often as they like, Burn a card, or Freeze their total, trying to finish the quarter
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
- Per-quarter fantasy scoring under a versioned ruleset (`packages/engine`),
  offense and defense (`sportsjack-v1`)
- A replay clock that runs a real recorded game at a chosen speed
- A visible "live data paused" state when the feed stalls or fails

**Game engine (server-authoritative)**
- Hands per quarter (plus an overtime bonus hand): ante, deal from the full
  game-day roster, live card values, Hit, Freeze, Burn, live
  bust and recovery, end-of-quarter settlement in play-money yards
- The vs-Dealer mode with an AI dealer that Hits, Freezes and Burns, at
  selectable difficulty levels: a Jev decision model, with a rule-based dealer
  behind the same interface
- The PvP mode at 6-max tables with a shared pot and a displayed rake
- Draws that can be reproduced from a committed seed
- An audit log: every card-value change records its feed event
- Disconnect and reconnect handling mid-hand

**Client (mobile-first web/PWA)**
- The prototype's lobby, buy-in, gameplay (the 21-dial), showdown and wallet
  screens (`prototype/`), driven by the real server
- A play-money onboarding hand with a guided overlay
- The hand as a card grid: tapping the hand expands it into a scrollable grid of
  cards, each showing the player, position, live stat line and current value,
  updating live like a dashboard
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

1. **The server decides; clients only render.** Clients send intents (Hit, Freeze,
   Burn, ante). They never compute or submit a card value, total or
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
6. **The dealer knows only what a player at the table could know.** It never
   sees future plays (the replay source knows them), undealt cards or another
   hand's private state. Every dealer decision is logged with the state it was
   given, its dealer version and difficulty level (shown to the player before the
   ante), and the probabilities it returned, so any hand can be audited.
7. **The factory cannot modify governance files.** `MISSION.md`,
   `FACTORY_RULES.md`, `FACTORY.md` and `engineering.md` are the constitution. A
   PR touching any of them is an automatic reject.
8. **The factory cannot modify its own judge.** `harness/`, `.factory/holdout/`
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
3. Watch card values change as the game's real plays arrive. Hit, then Freeze.
4. At the end of the quarter, see the hand settle and the play-money balance
   change by the amount shown on the result screen.

This runs on every change that touches runnable code, including ones that "seem
unrelated". It is not optional.

## Open questions -- decisions nobody has made yet

These are undecided, not forbidden. **The factory may propose an answer to any of
them**, build against it, and record what it assumed. The merge is then held for a
human, so nothing ships on a guess and nothing stops for one.

None are open right now. New ones go here.

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

- 2026-10-25 **Q11 Do actions lock before the quarter ends?** The lockout is a
  setting of each table, chosen by the player who opens it: none, 0:30, 1:00 or
  2:00 left in the quarter. It is shown before anyone sits and fixed for the life
  of the table. After the lockout, Hit, Burn and Freeze close, and cards keep
  moving to the end of the quarter. Simulation on real recorded quarters (the
  end-of-quarter rush the owner raised) informs the default (2:00 until then).
  Play-testing shows which settings players pick.
- 2026-10-25 **Q13 Should Jev read the game feed?** Not as the source of any
  value. Card values come only from the deterministic parser. Jev may act as a
  second opinion on what a play was: if it disagrees with the parser, the table
  pauses (invariant 2) rather than settling.
- 2026-10-25 **The out-of-scope list.** All seven entries are kept.
- 2026-10-25 **Q10 Do defenders score?** Yes. Ruleset `sportsjack-v1` adds IDP
  points (solo tackle 1, assist 0.5, sack 2, INT 3, forced fumble 3, pass
  defended 1, defensive TD 6) to `sportsjack-v0`. The values are tunable through
  new ruleset ids. Cards with no projection fall from 71% of the deck to 16%, so
  more cards can surprise. Evidence: `docs/analysis/D1-score-normalization.md`.
- 2026-10-25 **Q12 How is the AI dealer built?** On Jev (TypeSafe AI), a decision
  model: given the hand's state and scouting-style player information, it
  chooses Hit, Burn, Freeze or wait, with probabilities. Difficulty comes from
  how much scouting it is given and how it uses the probabilities. A rule-based
  dealer implements the same interface. It runs the tests, works offline, and
  stands in while Jev is in early access. A learning loop calibrates the levels
  over time.
- 2026-10-25 **How does a player see a hand with many cards?** Tapping the hand
  expands it into a scrollable grid of floating cards: player, position, live
  stats and current value, updating like a dashboard. Hits cannot exhaust the
  deck: a hand never holds the same player twice, and with a face value of at
  least 2 per card, a hand busts by about 11 cards.

- 2026-10-25 **Q1 (D1) How is a card's value scaled to 21?** Face value plus live
  points. At the deal each card gets a face value of 2–10 from the player's
  pre-game projection (proposed formula: 2 + 2 × projected quarter points,
  capped 2–10; tunable). Its live quarter points × 0.5 are added on top. Evidence:
  `docs/analysis/D1-score-normalization.md`.
- 2026-10-25 **Q2 (D2) What is the deck?** Every player on both teams' game-day
  active roster (about 96 cards). Bench players stay in the deck, so a player who
  comes off the bench is already a card, and the deck never needs managing during
  a game. Cards are not consumed: several hands can hold the same player.
- 2026-10-25 **Q3 (D3) Is there a Stand?** No. There is only **Freeze**, which
  locks the hand's total at that moment. After Freeze the hand takes no more
  actions. A hand that never freezes keeps moving live. Every hand ends when the
  quarter's clock runs out: hands are time-based, not turn-based.
- 2026-10-25 **Q4 (D4) Does Hit cost yards, and is there a card limit?** Hit is
  free, and there is no card limit. A player may Hit as often as they like until
  they Freeze or the quarter ends.
- 2026-10-25 **Q5 (D5) How do players get power-ups?** 1 Freeze + 1 Burn free per
  hand, for everyone. Burn is only usable before Freeze.
- 2026-10-25 **Q6 (D6) How does the dealer play?** It is an AI dealer that plays
  like a person: it Hits, Freezes and Burns. Its strength is adjustable, so
  tables can offer easier or harder dealers (for example a sharper dealer at
  higher stakes). It works from scouting-style information about the players. Its
  learning loop and calibration are tuned over time. How it is built is Q12.
- 2026-10-25 **Q7 (D7) Ties and all-bust hands?** A tie splits the pot. When
  everyone busts, the hand closest to 21 from above wins.
- 2026-10-25 **Q8 When does a hand start, and who can join?** A hand starts at the
  beginning of a quarter. **Overtime is a bonus hand:** a fifth hand that lasts
  the overtime period and ends when overtime ends, on a score or when its clock
  runs out. Nobody joins during a quarter. Players join a table between quarters
  (before Q2, at halftime, before Q4, before overtime). Joining a friend's game
  needs private tables, which come with the social features after this release.
- 2026-10-25 **Q9 Which live feed comes first?** ESPN's public JSON (scoreboard
  and play-by-play), behind `FeedSource`. Measure its delay and reliability in the
  alpha before considering a licensed provider. Replays of recorded games stay
  the test and demo source.
- 2026-10-25 **Which design is canonical?** The blackjack PRD
  (`prd/SportsJack-PRD.html`). The Texas Hold'em product brief in `docs/` is
  superseded and kept for history.
- 2026-10-25 **What is the first release?** The Phase 1 play-money alpha
  (`prd/PHASE1-ALPHA.md`), as an MVP: get the game running, then tune.
- 2026-10-25 **Where does game data come from?** Replays of real recorded NFL
  play-by-play from nflverse (CC-BY 4.0), then ESPN live (Q9). Yahoo Sports
  offers no public live API, so it cannot be the feed.
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
