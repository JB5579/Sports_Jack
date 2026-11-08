# Running a test round

The alpha is built to go in front of a small group of testers on their iPhones and
collect what they think and how they play.

## What to send testers

> Hi! I'm testing a new game: blackjack where the cards are real NFL players and
> their values move with real plays. It takes 5 minutes.
>
> 1. Open **<your Render URL>** in Safari on your iPhone.
> 2. Tap the Share button, then **Add to Home Screen**, and open SportsJack from there.
> 3. Play the free practice hand, then sit at a table for a couple of quarters.
> 4. Rate a hand or two, and tap **Send feedback** to tell me what you think.
>
> It's play money only. Nothing real is at stake.

Each phone gets its own play-money account with 1,000 yards. Nobody signs up. If a
tester adds their name in the feedback form, it's saved with their feedback.

## What gets collected

- **Feedback:** a 1–5 rating and/or a note, from the feedback form or the one-tap
  rating on each result sheet, with the screen it came from.
- **Events:** app opens (and whether it ran from the home screen), each practice
  coach step and whether the tester did it or skipped it, sitting, Hit, Burn, Freeze,
  each settled hand, leaving (and whether it was mid-hand), and opening the card
  grid, rules or wallet.

## Reading the results

All three need the admin key (`SPORTSJACK_ADMIN_TOKEN`, under the Render service's
**Environment** tab). Without it these addresses answer "not found".

- `<your URL>/api/admin/summary?key=<key>`: the headline numbers. Players, how many
  started and finished the practice hand, players who played a real hand, hands
  played, Hit/Burn/Freeze counts, feedback count, average rating, and
  **quarter-to-quarter continuation**: the share of hands where the player stayed
  for the next quarter. The PRD's target is above 80%.
- `<your URL>/api/admin/feedback.csv?key=<key>`: every rating and note.
- `<your URL>/api/admin/events.csv?key=<key>`: every event, for a spreadsheet.

Keep the key private: anyone with it can read the feedback.
