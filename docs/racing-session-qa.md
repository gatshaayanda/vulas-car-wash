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

## Recovery record — 8 November 2026

- Restored the racing gameplay files to the protected, product-owner-approved golden baseline recorded in `AGENTS.md`.
- Restored files: `racing-warmup.tsx`, `racing-warmup.css`, `racing-main-menu.tsx`, `racing-3d-scene.tsx`, and `racing-track-map.tsx`.
- This removes the later single-viewport boxed garage/game-shell implementation and returns the pit interface, HUD, scene and driving controls to the approved baseline structure.
- No steering model, throttle/brake/NOS input semantics, vehicle physics, camera tuning or track geometry was intentionally changed by this recovery.
- Service-worker/PWA cache updates, app identity, and the protected golden-baseline reference branch were left untouched.
- Verification status: source restoration recorded; automated CI and Vercel deployment must be checked against the resulting commit. Live mobile gameplay and offline launch remain unverified until tested on-device.
- QA priority: confirm the game opens into the playable circuit, the car can be driven freely, car colour can be changed in the pit, and the player can complete the existing practice → qualifying → pit review → Kago race → pit return loop.
- Follow-up control-layout comparison: inspect the approved space-game controls and reproduce only their placement/interaction layout in Vula Racing if needed. Preserve Vula's existing analog steering and driving inputs unless the product owner explicitly approves a control change.


## Deployment retry — 8 November 2026

- Trigger a fresh production deployment from the restored `main` gameplay baseline.
- This documentation-only chore does not alter racing source, controls, physics, save data, or PWA behaviour.
- QA must use the deployment built from the current `main` commit, not an older cached deployment.


## Live circuit map — 8 November 2026

- The map tracks the player's actual world-space position and Kago's independent world-space position.
- Kago's marker is hidden during solo practice and qualifying, and appears from the scored race grid onward (lap 3+) only after his vehicle state is initialized.
- The map legend identifies YOU and KAGO; the existing pit entry, exit and service-bay markings remain visible.
- This is a HUD-only change. It does not alter player or bot physics, controls, camera, track geometry, collision handling, session flow or saves.
- QA: confirm the player marker follows the car; Kago is absent in practice/qualifying; both markers appear at the race start and move independently; the Kago marker follows his actual car through corners and pit entry/exit.


## Fresh deployment trigger — 8 November 2026

- Documentation-only commit to request a new Vercel production build after the prior build-rate-limit response.
- No gameplay source, controls, physics, camera, track, saves, or PWA assets are changed by this trigger.
- Confirm the deployment is built from this exact main commit before asking for gameplay QA.
