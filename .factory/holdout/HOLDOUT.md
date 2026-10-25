# Holdout scenarios

Independent scenarios that combine SportsJack behavior in ways the journeys do
not. Each uses a real recorded game. Start a fresh environment for this pass.

This file sits in the builder's checkout, so it is **not** private. For a real
holdout, move it outside the repository and give it only to the verification
environment (see `FACTORY.md`).

## A negative play pulls a bust back under 21

1. Replay Super Bowl LX (`2025_22_SEA_NE`) quarter 3 at a vs-Dealer table, with a
   hand that holds D. Maye (NE QB).
2. Hit until the total is over 21. The dial shows "busted" in red with how far
   over, and the hand is still live.
3. When the 0:16 play arrives (Maye sacked and fumbles, recovered by SEA), Maye's
   value drops.
4. If that drop brings the total to 21 or under, the dial leaves the bust state.
   At the end of the quarter the hand is ranked as a non-bust.

## A defender's card swings on a takeaway

1. Replay Super Bowl LX quarter 3. Find D. Hall (SEA) in the table's player list.
2. When the 0:16 play arrives (Hall sacks Maye and forces a fumble that SEA
   recovers), Hall's value rises by the sack and forced-fumble points on the rules
   screen, and Maye's falls, on the same play.
3. Any hand holding Hall shows the higher total right after that play, even
   though the play came inside the action lockout.

## Disconnect after Freeze, reconnect before the whistle

1. Ante at a vs-Dealer table on any fixture game, then Freeze.
2. Close the client mid-quarter, for at least 20 replayed plays.
3. Reopen it before the quarter ends. The same hand is shown with the same frozen
   total, and no action (Hit, Burn, Freeze) is offered.
4. The hand settles on the frozen total. The balance is the same as if the client
   had never left.

## Two quarters in a row at the same table

1. Replay `2026_07_NE_CHI` quarters 1 and 2 at one vs-Dealer table. Ante both
   quarters.
2. Quarter 2's cards start from their quarter-2 values. Points scored in quarter 1
   do not carry over.
3. After both settle, the history lists two hands. The balance equals the starting
   balance, minus both antes, plus both payouts shown.
4. Restart the app. The two settled hands and the balance are unchanged.

## Joining at halftime, never mid-quarter

1. Replay `2025_04_GB_DAL` (40–40 after overtime). Player A sits at a PvP table
   before quarter 1.
2. Player B tries to sit at the same table during quarter 2. They are told they
   can join at the next break, and are not dealt into quarter 2.
3. At halftime player B sits. Both are dealt into quarter 3.
4. Overtime runs its full clock with no winning score. The overtime hand ends when
   the overtime clock runs out and settles normally.

## Two tables, two lockouts, one quarter

1. Replay `2026_07_NE_CHI` quarter 2. Player A opens a vs-Dealer table with no
   lockout. Player B opens one with a 2:00 lockout. The lobby shows each table's
   lockout before anyone sits.
2. With 1:30 left in the quarter, player A can still Hit. Player B is offered no
   Hit, Burn or Freeze, and B's cards keep changing.
3. Both hands settle at the end of the quarter, and each table's lockout is the
   same in the following quarter.

## Everybody busts

1. Three players sit at one PvP table on `2025_21_LA_SEA` and ante. Each Hits
   until busted and stays busted to the whistle.
2. The pot goes to whichever hand is closest to 21 from above (MISSION.md Q7),
   and the rules screen says so.
3. The sum of all balances plus the displayed rake is unchanged.

## The same seed deals the same hand

1. Play one quarter of any fixture game and note the hand's committed seed and
   the cards dealt and drawn.
2. Replay the same game and quarter with the same seed, and make the same Hit and
   Burn decisions at the same plays.
3. The same players are dealt and drawn in the same order, and the final total and
   outcome are identical.
