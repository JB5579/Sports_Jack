# SportsJack foundation: what we need whatever the game becomes

**Status:** proposed 2026-11-16, awaiting the owner's approval. §1 (the ledger) is built.
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
| 3 | Contest layer | Not built; tables hold this logic today | No |
| 4 | Variant switches | Not built | No |
| 5 | Live feed | Replay only; ESPN adapter is Phase 1 feature 16 | No |
| 6 | Retention dashboard | A summary endpoint exists | No |
| 7 | Simulation harness | One-off scripts in `tools/analysis` | No |
| 8 | Friends and invites | Not built | No |
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

- A hand that is dealt but never settles (the server stops mid-quarter) leaves its antes in
  the pot. A refund transaction for abandoned pots is not built.
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

## 3. Contest layer

Today a table decides who is in, what they pay, how cards are dealt and who is paid. Split
that into a **contest** that owns entry and prizes, and the **rules** that play a hand.

- A contest has: a game and period, entrants, an entry (free, chips, or a ticket), a prize
  rule (winner takes the pot, top share, fixed prize), a deal mode (each player their own
  cards, or everyone the same cards) and a seat limit (6, or unlimited for pooled contests).
- Dealer tables, player tables, pooled quarter contests, friends' tables, a daily hand on a
  classic game and same-cards-for-everyone are all contests with different settings.
- Entry and prizes post through the ledger. The rules engine stays pure and unchanged.

## 4. Variant switches

Named switches, set per table or per player, recorded on every hand and every usage event.

- Two or three versions of the game can run side by side and be compared on the same
  numbers. This is how the MVP variations get tested with real players.
- A switch may change a rule set, a contest setting or a screen. It may never change a
  MISSION.md invariant.

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

Share links that open a private table, a friends list, and referral attribution: who
invited whom, posted to the ledger as a `referral` bonus once the friend plays a hand.

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
