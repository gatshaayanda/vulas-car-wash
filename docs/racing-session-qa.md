# Vula Racing session QA checklist

Use the normal customer entry point: https://vulas-car-wash.vercel.app/ → Vula Racing → New Game.

## Session loop

- Warm-up Practice remains open-ended; completing laps never starts qualifying automatically.
- The player deliberately starts one qualifying session.
- Qualifying completes once, saves the player's time and grid result to the selected local driver save, and returns to the pit flow.
- The pit menu can be opened to review the latest qualifying result before starting the Kago race.
- Starting a race uses the most recent valid qualifying grid. Without a valid qualifying result, the player starts from the back.
- Completing a race shows the win/loss result and celebration, then automatically returns to the pit garage and opens the pit menu.
- The previous qualifying result remains available after a race. A newly completed qualifying session replaces it for the next race.
- The last race result and driver identity remain available after reloading the saved driver.

## Offline and online checks

- Open the game online once, then verify it launches and remains playable offline from the installed/cached app.
- Treat offline results as device-local only; do not represent them as server-verified leaderboard results or rewards.
- Verify authenticated online career persistence separately through the existing `/api/racing` flow. This checklist does not imply real-time multiplayer rooms or matchmaking are implemented.

## Physical gameplay checks

- Drive the pit entry and exit in warm-up, qualifying and race sessions; confirm the car remains under player control and is never snapped to a pit position.
- Check the rough corner, visible barriers, map marker colour, toast placement and mobile portrait/landscape layouts.
- Test both a race win and loss, then repeat using the saved qualifying position.

Report source checks, Vercel deployment status, offline persistence and actual device gameplay QA separately. Do not claim physical or visual QA unless it has been performed in the live game.