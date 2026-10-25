# Runtime scenarios

The journeys a real SportsJack alpha player takes. Every one runs against a
**real recorded NFL game** replayed from `fixtures/nflverse/games/`, so the values
a player sees come from plays that really happened. Shared runtime verification
owns execution and evidence.

Exact point values depend on open question Q1 in `MISSION.md`, so these journeys
check directions, sums and real plays rather than fixed totals.

## A new player plays one quarter against the dealer

1. Start the app with Super Bowl LX (`2025_22_SEA_NE`) set to replay quarter 1 at
   high speed.
2. Open the lobby. The game is listed as SEA @ NE, with at least one vs-Dealer
   table.
3. Sit at the table with the smallest stake. The dealer's difficulty level is
   shown. Ante. The play-money balance drops by exactly the ante.
4. Two cards are dealt. Each one names a real SEA or NE player from that day's
   active roster and shows a value.
5. While the quarter replays, at least one card's value changes. The 21-dial
   total always equals the sum the cards show.
6. Hit once. A third card joins the hand, and the hand keeps moving live. There is
   no Stand button.
7. At the end of the quarter the result screen shows the player's final total,
   the dealer's final total and the outcome. The balance changes by exactly the
   payout the screen shows.
8. Reload the page. The balance and the settled hand in the history are the same.

**What would make this fail:** values that never move, a total that disagrees
with the cards, a balance change that differs from the payout shown, or a
settled hand that changes or disappears after a reload.

## A real touchdown moves the card that holds the scorer

1. Replay Super Bowl LX from the start of quarter 4.
2. Open the card detail for D. Maye (NE QB) or M. Hollins (NE WR): from a hand
   that holds them, or from the table's player list.
3. When the 12:33 play arrives (Maye's 35-yard touchdown pass to Hollins), both
   players' values go up, and the detail view lists that play as the reason.
4. Any hand holding either player shows a higher total right after that play.

**What would make this fail:** a value change with no play listed against it,
the touchdown not changing the value, or the hand total not following the card.

## Freeze locks the number; Burn replaces a card

1. Replay `2025_21_LA_SEA` (31–27, the NFC Championship) from quarter 1 and ante
   at a vs-Dealer table.
2. Use Burn on one card. That card leaves the hand, and a different real player
   from the same game replaces it. Burn cannot be used again this hand.
3. Use Freeze. The total stops changing, even when later plays change the
   individual cards' values. Freeze cannot be used again this hand.
4. At the end of the quarter, the hand settles on the frozen total.

**What would make this fail:** a frozen total that moves, a Burn replacement from
another game or already in the hand, or a power-up usable twice.

## Overtime is a bonus hand

1. Replay `2025_16_LA_SEA` (LA 37, SEA 38 in overtime) from quarter 4 and sit at
   a vs-Dealer table.
2. After quarter 4 settles, a fifth hand is offered for overtime. Ante into it.
3. The overtime hand ends when the game ends on SEA's winning score, with time
   still on the overtime clock, and it settles like any other hand.
4. The history shows the overtime hand separately from the four quarters.

**What would make this fail:** no overtime hand, an overtime hand that waits for
a full period after the game has ended, or overtime points counted in quarter 4.

## Two players share a PvP table and the yards add up

1. Replay `2026_07_NE_CHI` from quarter 2. Two different players sit at the same
   PvP table and ante the same stake.
2. Both see the same card values change at the same moments.
3. At the end of the quarter the winner is the total closest to 21 without going
   over (ties and all-bust hands follow the rules screen).
4. The winner's balance rises by the pot minus the rake shown before the hand.
   The loser's balance is down by exactly their ante. Before and after, the two
   balances plus the rake add up to the same number.

**What would make this fail:** players seeing different values, a winner who is
not closest to 21, or yards created or lost beyond the displayed rake.

## The feed stalls mid-quarter

1. Replay any fixture game and ante at a table.
2. Pause the replay feed partway through the quarter.
3. The table shows "live data paused". Card values stop changing, and the hand
   does not settle while paused, even after the quarter's replay time runs out.
4. Resume the feed. Values move again and the hand settles normally at the end of
   the quarter.

**What would make this fail:** settling on stale values, values that change while
paused, or no visible paused state.
