# SportsJack foundation: what we need whatever the game becomes

**Status:** approved by the owner 2026-11-16. §1 (the ledger), §3 (contests) and §4 (variant switches) are built.
**Parents:** `MISSION.md` governs. `prd/PHASE1-ALPHA.md` scopes the play-money alpha. This
document adds the parts of the product that every game design and every business model
under discussion will need, so they can be built while the MVP shape is still being decided.

## Why now

The team is still choosing the game's variations and how it earns: sponsored free contests,
friends' tables, a partner's licence, or paid contests later. Those choices change the rules
and the screens. They do not change the eleven pieces below. Each is written so that the
open choices become settings, not rewrites.

Nothing here moves real money (MISSION.md invariant 3). Where a piece would one day touch
real money, identity or a regulated activity, this document builds the seam and leaves the
decision to the owner.

## The eleven pieces

| # | Piece | Status | Depends on an open decision? |
|---|---|---|---|
| 1 | Ledger | **Built** (`packages/ledger`) | No |
| 2 | Accounts | Device-scoped accounts only | Yes: the sign-up method |
| 3 | Contest layer | **Built** (`packages/engine/src/contest.ts`) | No |
| 4 | Variant switches | **Built** (`apps/server/src/variants.ts`) | No |
| 5 | Live feed | Replay only; ESPN adapter is Phase 1 feature 16 | No |
| 6 | Retention dashboard | A summary endpoint exists | No |
| 7 | Simulation harness | One-off scripts in `tools/analysis` | No |
| 8 | Friends and invites | Referral links and creator codes built; private tables not | No |
| 9 | Partner seam | Not built | No |
| 10 | Compliance hooks | Not built | Yes: vendors and rules |
| 11 | Production database and monitoring | SQLite on one Render disk | No |

Build order: 1, then 3 and 4 together, then 2 and 5, then 6 to 8. Pieces 9 to 11 wait for a
partner conversation or real players.

## 1. Ledger (built)

One auditable record of every movement of chips, and later of any other unit of value.

**Rules it enforces**

- **Double entry.** A transaction is two or more entries that sum to zero. Value is moved,
  never made or lost. New chips come from the system account `house:issuance`, which goes
  negative by exactly what it has issued.
- **Append-only.** Database triggers refuse any change or deletion of a transaction or an
  entry. A mistake is corrected by a new, opposite transaction.
- **Idempotent.** Every transaction has a key (`ante:<hand>:<account>`, `settle:<hand>`).
  Posting the same key twice changes nothing the second time, so a retry cannot double-pay.
- **No overdrafts.** A player account never goes below zero. System accounts may.
- **Whole units, per currency.** Amounts are integers. Each transaction is in one currency
  (`chips` today), and currencies never mix.
- **Auditable.** `audit()` rebuilds every balance from the entries and reports any
  transaction that does not sum to zero, any balance its entries do not explain, any
  overdrawn player and the grand total per currency, which must be zero.

**Accounts**

| Account | Kind | Holds |
|---|---|---|
| `<player id>` | player | A player's chips |
| `house:issuance` | system | The source of starting chips, bonuses and top-ups |
| `pot:<hand id>` | system | A hand's antes between the deal and settlement |
| `house:table` | system | The house side of settled hands: the dealer's and bots' results, and the rake |

**How a hand moves chips**

1. Deal: each seated player's ante moves from the player to `pot:<hand>`.
2. Settle: one transaction empties the pot, pays each winner, and moves the difference to
   or from `house:table`. Bots and the dealer hold no accounts, so their side of the hand is
   that difference.

**Where it lives**

- `packages/ledger`: the `Ledger` class over a `node:sqlite` handle, with its tests.
- `apps/server/src/store.ts`: `account`, `debit` and `recordHand` post through the ledger.
  The old single-entry `ledger` table and `accounts.balance` column are no longer written.
  On first start, each existing account's balance becomes one `opening` transaction.
- `GET /api/admin/audit` (owner key required) returns the audit report.

**Known gaps**

- `house:table` does not yet separate the rake from the dealer's and bots' results.
- The ledger is tied to SQLite. Piece 11 moves it to Postgres behind the same interface.

**What it makes possible without redesign:** sponsored prizes (a `prize` transaction from a
sponsor account), referral bonuses, friends' score-keeping (a currency per table), and a
partner's wallet (the partner's balance replaces the player account behind the same calls).

## 2. Accounts

A player keeps their chips and history across devices.

- An account is an id plus one or more ways to prove it is yours. Today the only proof is a
  device token. The account layer accepts further proofs (email link, phone code, Apple or
  Google sign-in) without changing the id, so a device account can be upgraded in place.
- **Owner decision:** which proofs to offer, and when one is required. Until then, build the
  layer and one upgrade path behind a switch, off by default.

## 3. Contest layer (built)

Every table plays for a **contest**, which owns entry, prizes, the deal and seats. The
**rules** that play a hand (`GameRules`) do not change with the contest.

| Setting | Values |
|---|---|
| Entry | `free`, or a number of chips |
| Prize | `none` (practice, not recorded), `table` (the hand's own settlement: even money against the dealer, or winners split the antes after rake), `pool` (fixed prizes by place, paid by a sponsor account) |
| Deal | `own` (each seat its own cards), `shared` (everyone dealt the same cards; the same moves draw the same cards) |
| Seats | a limit, or none |
| Bots | fill a player table to this many seats with labeled bots, or 0 |

`contestProblem()` refuses settings that mix models: a pool must be free to enter and paid by
a `sponsor:` account, and a table prize needs a paid entry.

**The contests the app runs**

| Contest | Entry | Prize | Deal | Seats | Bots |
|---|---|---|---|---|---|
| House dealer | 25, 100 or 1,000 chips | table | own | no limit | 0 |
| Player table | 25, 100 or 1,000 chips | table | own | 4 | fill to 4 |
| Practice | free | none | own | 1 | 0 |
| **Free quarter contest** (new, one per game) | free | pool: 500 / 250 / 100 chips from `sponsor:sportsjack` | shared | no limit | 0 |

**Pool prizes.** Only totals at or under 21 can win. Players tied for a place share the
prizes of the places they cover, rounded down; the remainder stays with the sponsor. The
sponsor's ledger account goes negative by exactly what it has paid.

**Where it lives:** `packages/engine/src/contest.ts` (settings, validation, pool prizes),
`HandOptions.deal` (the shared deal), `apps/server/src/lobby.ts` (`CONTESTS`, every table made
through one place), `apps/server/src/table.ts` (entry, seat limits, payouts). Each hand
records its contest in the `hands` table.

**Next:** friends' tables and the daily hand on a classic game are new contest settings, not
new code paths.

## Game situations (built 2026-11-16)

The edge-case rules approved in the MVP requirements. They apply to every contest.

| Situation | Rule | How it is detected |
|---|---|---|
| A player is injured | His card keeps its value as of that play. Every hand holding him that can still act gets one extra Burn. He is not dealt again that hand. | NFL: the play-by-play's "TEAM-##-F.Last was injured during the play", matched to the card by team and short name. NBA play-by-play does not report injuries, so this rule waits for a live source that does. |
| A blowout | No change: the cards keep moving with every play. | — |
| The game is suspended or cancelled | Every live hand on it is void: no result, every ante refunded. | A `game_status` event from a live feed, or the owner: `POST /api/admin/void` with `{"game": ...}` or `{"table": ...}`. |
| The server stops mid-quarter | Same as a void hand: on start, every pot still holding antes is refunded. | Automatic on start. |

Refunds are ledger transactions keyed `refund:<hand>`, so they are paid once. A void hand is
not in the hand history and does not count toward the rewards track; it is logged as a
`hand_void` event.

## 4. Variant switches (built)

Named switches that let versions of the game run side by side and be compared on the same
numbers. A switch may change a contest setting, a ruleset choice or a screen. It may never
change a MISSION.md invariant.

| Switch | Scope | Values | Default | What it changes |
|---|---|---|---|---|
| `variation` | player | A, B, C | A | Which MVP prototype variation a player sees. B adds safer cards (`docs/analysis/safer-cards.md`); C plays as A until it is built. |
| `free_contest_deal` | table | shared, own | shared | Whether the free quarter contest deals everyone the same cards. |

**Setting them.** The owner sets weights in `SPORTSJACK_VARIANTS`, for example
`variation=A:50,B:50;free_contest_deal=own`. A mistyped switch or value stops the server from
starting, so a typo can't silently put everyone on the default.

- **Player switches** are assigned once per account by a stable hash, then kept. Changing the
  weights later moves only new players. The owner can move one player by hand with
  `POST /api/admin/variants`.
- **Table switches** take the heaviest-weighted value for the whole server.

**Recording.** Every usage event and every settled hand records the player's switches.
`GET /api/admin/summary` reports players, hands and quarter-to-quarter continuation for each
value (`byVariant`). `GET /api/admin/variants` lists the switches, the weights and how many
players are on each value. Both need the owner key.

**Variation B is built:** players on it can make a card safer before its player scores. It
moves half as much, and each safer card cuts a win by 10%. Rulesets `alpha-2` and `alpha-nba-3`
carry the setting; everyone else plays exactly as before. Variation C is not built.

## 5. Live feed

A provider-neutral live adapter behind the existing `FeedSource` interface, with ESPN first
(Phase 1 feature 16). It records the delay between a play and its arrival, handles
corrections, and pauses the table when it cannot be sure. A licensed provider can replace
ESPN later without the engine noticing.

## 6. Retention dashboard

Quarter-to-quarter continuation, weekly return, hands per player and time to first hand,
by variant, from the usage events already recorded. An owner-only page, replacing the JSON
summary.

## 7. Simulation harness

One command that runs any rule set and any player strategy across the recorded games and
reports where totals land, bust rates, the house edge and how often a skilled strategy
beats a random one. It replaces the one-off scripts and produces the skill evidence an
attorney or partner would ask for.

## 8. Friends and invites

**Built (variation A):**

- **Referral links.** Every player has a six-character code (no 0/O or 1/I) and a link,
  `/?ref=CODE`, shared from the lobby. A new account that arrives with a code is recorded as
  referred; an existing account, an unknown code or the player's own code is ignored.
- **The bonus.** When the friend settles a first real hand, both get 500 chips (half a
  starting stack, after Gianni's "50% to both"), paid from `house:promotions`.
- **Creator codes** for influencers, made by the owner (`POST /api/admin/codes`). Friends who
  use one get the bonus; `GET /api/admin/codes` counts who joined and played through each.
- **The rewards track.** Chips for hands played (1: 100, 4: 250, 10: 500, 25: 1,000,
  50: 2,500) and 250 for playing all four quarters of a game at one table. The `rewards`
  switch (on or off per player) tests whether the track changes retention; referral bonuses
  apply either way.

Every bonus is a ledger transaction with its own key, so it is paid once, and the summary
reports referrals and `promotionsPaid`.

**Not built:** share links that open a private table, and a friends list.

## 9. Partner seam

The game packaged so another company can run it: interfaces for the partner's accounts and
wallet (in place of pieces 1 and 2), a theme, and an embed that needs nothing else from us.

## 10. Compliance hooks

Named places in the flow for an age check, a location check, play limits and self-exclusion.
Each defaults to "allow" and records that it was asked. **Owner decision:** the vendors and
the rules, when a business model requires them.

## 11. Production database and monitoring

Move from SQLite to Postgres behind the store and ledger interfaces, add error alerting and
uptime checks, and run the ledger audit on a schedule.

## Decisions for the owner

1. Approve this document as the plan for foundation work alongside Phase 1.
2. The sign-up method (piece 2).
3. Whether an abandoned hand's antes are refunded automatically (piece 1, known gaps).
