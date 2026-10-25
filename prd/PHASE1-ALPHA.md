# SportsJack Phase 1: play-money alpha

**Parent:** `prd/SportsJack-PRD.html` (v1.0). This document scopes the first
release. Where they differ, this one wins for this release, and `MISSION.md` wins
over both.

## Goal

Prove the mechanic on real football before any real money is involved (PRD §17,
"de-risk with a play-money alpha"): does a quarter of live-moving NFL cards make
Hit or Freeze feel tense? Every hand in this release is played on a **real recorded
NFL game** replayed through the feed, with **play-money yards**.

## What already exists

- `packages/feed`: the `FeedSource` interface, an nflverse play-by-play parser and
  `ReplaySource`, which plays a recorded game back paced by its game clock.
  Tested against nflverse's own box scores for five real games, including overtime.
- `packages/engine`: `QuarterScorer` with rulesets `standard-ppr` and
  `sportsjack-v0` (PRD §4.1). It matches nflverse's PPR totals exactly.
- `fixtures/nflverse/`: Super Bowl LX, the 2025 NFC Championship, two overtime
  games (`2025_16_LA_SEA` ends on a score, `2025_04_GB_DAL` is a 40–40 tie) and
  2026 Week 7 NE @ CHI. Each has its plays, its game-day active roster (the deck,
  in `rosters/`) and nflverse's box score. Add more with
  `npm run fixtures -- --games <game_id>`.
- `tools/replay.ts`: `npm run replay -- 2025_22_SEA_NE --speed 120 --qtr 4`
  prints a real game's plays and card values.
- `prototype/`: the designed screens (lobby, buy-in, gameplay with the 21-dial,
  showdown, wallet), in React with mock data in `components/data.jsx`.
- `docs/analysis/D1-score-normalization.md`: the evidence behind MISSION.md Q1.

## The first ticket: a runnable skeleton

This makes the product runnable end to end and is the base for every later ticket.

- **Stack:** TypeScript on Node 22 in this npm workspace. The server goes in
  `apps/server`: an HTTP + WebSocket server (for example Fastify with `ws`) that
  owns all game state. The client goes in `apps/web`: React + Vite, built to static
  files the server serves, porting `prototype/` components.
- **Start command:** `node --experimental-strip-types apps/server/src/main.ts`,
  listening on `PORT`. If a build step is added, the start argv must still be one
  command the runtime host can run from a fresh checkout after `npm ci`.
- **Health:** `GET /health` returns 200 with `{"status":"ok"}` once the server
  is ready to deal.
- **Build identity:** `GET /build-id` returns `FACTORY_RUNTIME_CANDIDATE` exactly
  when it is set, otherwise the Git commit.
- **State:** play-money accounts, balances and hand history in SQLite (Node's
  built-in `node:sqlite`) at the file named by `SPORTSJACK_DB`. A new path is a
  fresh state.
- **Replay selection:** `SPORTSJACK_REPLAY` (a fixture game id),
  `SPORTSJACK_REPLAY_SPEED` (default 60), `SPORTSJACK_REPLAY_FROM_QUARTER`
  (default 1).
- **Test controls:** when `SPORTSJACK_TEST_CONTROLS=1`, the server also exposes
  pausing and resuming the replay feed, so runtime checks can exercise the
  feed-loss path. Off by default.
- **Tests and CI:** `npm test` (Vitest) and `npm run typecheck`, run by
  `python harness/ci.py` in the `tests` GitHub Actions job. Never remove the
  real-game fixture tests.

## Features in this release

Each one ends with a user-visible result in the client, verified on a replayed
real game.

1. **Lobby from the replay schedule, and opening a table.** The lobby lists the
   configured replay game(s) with teams, score and quarter. Each game offers
   vs-Dealer and PvP tables at the stakes 25, 100 and 1,000 yards. A player can also open a table, choosing its mode, stake and action lockout
   (none, 0:30, 1:00 or 2:00 left in the quarter; default 2:00). The lobby shows
   each table's lockout before anyone sits, and it never changes for that table.
   Add a simulation to `tools/analysis/` comparing the lockout settings on real
   recorded quarters: how often a trailing player wins by hitting late. Its
   results set the default.
2. **Joining between quarters.** A player can sit at a table before any quarter
   (or before overtime), never during one. A player already seated is dealt in
   automatically each quarter unless they leave.
3. **Play-money account.** A visitor gets a play-money account with a starting
   yards balance, with no sign-up wall (D9). The sign-up and login design is a
   human decision (MISSION.md). Until it is made, use an anonymous
   device-scoped account and flag the assumption.
4. **The deck and the deal (Q1, Q2).** The deck is both teams' game-day active
   roster (nflverse weekly rosters, `ACT`). At the start of a quarter each seated
   player antes and is dealt 2 cards. A card's value is its face value (2–10, from
   the player's pre-game projection) plus live quarter points × 0.5, under ruleset
   `sportsjack-v1` (offense and defense, Q10). Draws come from a seed committed before the deal.
5. **Live hand.** Card values update from the feed on one server tick for the
   whole table. The 21-dial shows the total, the distance to 21 and a live-bust
   state ("X over", recoverable).
6. **Hit, Burn and Freeze (Q3–Q5).** Hit draws a card: free, with no card limit.
   Burn (once per hand, before Freeze) swaps one card for a new draw from the same
   game. Freeze (once per hand) locks the total and ends the hand's actions. There
   is no Stand. An unfrozen hand stays live until the quarter ends. Actions lock at
   the table's lockout time (Q11), and the cards keep moving until the quarter
   ends.
7. **Overtime bonus hand (Q8).** An overtime period is a fifth hand. It ends when
   overtime ends, on a score or when its clock runs out. Test with
   `2025_16_LA_SEA` (ends on a score) and `2025_04_GB_DAL` (a 40–40 tie).
8. **AI dealer (Q6, Q12).** The vs-Dealer opponent plays like a person: it Hits,
   Burns and Freezes, using the same live values and projections a player sees
   (MISSION.md invariant 6). Its difficulty level is selectable per table and shown
   before the ante. Two implementations share one dealer interface:
   - a rule-based dealer, used by tests and whenever Jev is unavailable;
   - a Jev dealer (TypeSafe AI), which asks Jev to choose Hit, Burn, Freeze or
     wait, with probabilities, from the hand's state and scouting-style player
     information. Its credentials come from the environment and are never
     committed. Its tests use recorded responses, never the network.

   Log every dealer decision with its input and probabilities. Measure each
   level's win rate by simulating real recorded quarters (`tools/analysis/`), and
   show the levels on the rules screen.
9. **PvP 6-max (D7).** A shared pot of antes, with the rake shown before the hand
   (8–12%, PRD §5.2), closest to 21 without going over wins, and the tie and
   all-bust rules from Q7.
10. **Settlement and history.** At the end of the quarter the hand freezes, is
   scored and settles. The balance and the hand history persist across restarts.
   Each hand records its ruleset id, seed and the feed events that moved its cards.
11. **Feed paused state.** When the feed stalls, the table shows "live data
    paused", values hold and nothing settles until the feed resumes (PRD §11).
12. **Disconnect and reconnect.** A client that drops mid-hand gets the same hand
    back when it reconnects. The hand keeps playing server-side while it is away.
13. **The hand as a card grid.** Tapping the hand expands it into a scrollable
    grid of floating cards, a live dashboard of the hand. Each card shows the
    player, position, team, live stat line for the quarter, current value and the
    plays that moved it. It must stay readable on an iPhone with 10 or more cards.
14. **Onboarding hand.** A first-time visitor is dropped into a guided vs-Dealer
    hand on a replayed game, with an overlay teaching Hit, Burn and Freeze
    (PRD §8.1).
15. **Rules screen.** It shows the scoring ruleset, deck, dealer levels, lockout
    time, tie and bust rules and the rake: everything a hand's outcome depends on.
16. **ESPN live feed (Q9).** A second `FeedSource` that follows a live game
    through ESPN's public scoreboard and play-by-play JSON, polling about every
    10 seconds. It emits the same events as the replay source, so the engine
    cannot tell them apart. Record each delay (play time vs. arrival) so its
    performance can be judged. Its tests use recorded ESPN responses saved as
    fixtures, never the network. ESPN does not publish this API, so treat any
    field as able to change, and pause the table (feature 11) rather than guess.

## Not in this release

Wallet, USDC, Solana, escrow, KYC, geofencing, a fiat on-ramp, push
notifications, leaderboards, cosmetics, chat and social (including private
tables and joining a friend's game), native apps and licensed data providers. Most come later. Some (see MISSION.md "Out of scope") never do.

## Success for this release

The owner plays full replayed quarters on several real games and judges whether
the mechanic is fun. That judgment is human (MISSION.md). The factory's part is
that every rule is correct, visible and reproducible on real data.
