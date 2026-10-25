# SportsJack Phase 1: play-money alpha

**Parent:** `prd/SportsJack-PRD.html` (v1.0). This document scopes the first
release. Where they differ, this one wins for this release, and `MISSION.md` wins
over both.

## Goal

Prove the mechanic on real football before any real money is involved (PRD §17,
"de-risk with a play-money alpha"): does a quarter of live-moving NFL cards make
Hit or Stand feel tense? Every hand in this release is played on a **real recorded
NFL game** replayed through the feed, with **play-money yards**.

## What already exists

- `packages/feed`: the `FeedSource` interface, an nflverse play-by-play parser and
  `ReplaySource`, which plays a recorded game back paced by its game clock.
  Tested against nflverse's own box scores for three real games.
- `packages/engine`: `QuarterScorer` with rulesets `standard-ppr` and
  `sportsjack-v0` (PRD §4.1). It matches nflverse's PPR totals exactly.
- `fixtures/nflverse/`: Super Bowl LX, the 2025 NFC Championship, and 2026 Week 7
  NE @ CHI (plays, rosters, box scores). Add more with
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

1. **Lobby from the replay schedule.** The lobby lists the configured replay
   game(s) with teams, score and quarter. Each game offers vs-Dealer and PvP
   tables at the stakes 25, 100 and 1,000 yards.
2. **Play-money account.** A visitor gets a play-money account with a starting
   yards balance, with no sign-up wall (D9). The sign-up and login design is a
   human decision (MISSION.md). Until it is made, use an anonymous
   device-scoped account and flag the assumption.
3. **The deck and the deal (D2, Q1).** At the start of a quarter, each seated
   player antes and is dealt 2 cards from the game's deck. Card values follow
   MISSION.md Q1's proposed rule, under a versioned ruleset. Draws come from a seed
   committed before the deal.
4. **Live hand.** Card values update from the feed on one server tick for the
   whole table. The 21-dial shows the total, the distance to 21 and a live-bust
   state ("X over", recoverable).
5. **Hit and Stand (D3, D4).** Hit draws a card (free, at most 5 cards). Stand
   stops drawing, and the cards stay live. There is no Hit after Stand.
6. **Freeze and Burn (D5).** One of each free per hand. Freeze locks the total.
   Burn swaps one card for a new draw from the same game.
7. **vs-Dealer (D6).** A deterministic, published dealer policy, chosen by
   simulating real recorded quarters (add the simulation to `tools/analysis/`)
   and shown on the rules screen.
8. **PvP 6-max (D7).** A shared pot of antes, with the rake shown before the hand
   (8–12%, PRD §5.2), closest to 21 without going over wins, and the tie and
   all-bust rules from Q7.
9. **Settlement and history.** At the end of the quarter the hand freezes, is
   scored and settles. The balance and the hand history persist across restarts.
   Each hand records its ruleset id, seed and the feed events that moved its cards.
10. **Feed paused state.** When the feed stalls, the table shows "live data
    paused", values hold and nothing settles until the feed resumes (PRD §11).
11. **Disconnect and reconnect.** A client that drops mid-hand gets the same hand
    back when it reconnects. The hand keeps playing server-side while it is away.
12. **Card detail.** Tapping a card shows the player's live stat line for the
    quarter and the plays that moved the value.
13. **Onboarding hand.** A first-time visitor is dropped into a guided vs-Dealer
    hand on a replayed game, with an overlay teaching Hit, Stand, Freeze and Burn
    (PRD §8.1).
14. **Rules screen.** It shows the scoring ruleset, deck, dealer policy, tie and
    bust rules and the rake: everything a hand's outcome depends on.

## Not in this release

Wallet, USDC, Solana, escrow, KYC, geofencing, a fiat on-ramp, push
notifications, leaderboards, cosmetics, chat and social, native apps and a live
provider feed. Most come later. Some (see MISSION.md "Out of scope") never do.

## Success for this release

The owner plays full replayed quarters on several real games and judges whether
the mechanic is fun. That judgment is human (MISSION.md). The factory's part is
that every rule is correct, visible and reproducible on real data.
