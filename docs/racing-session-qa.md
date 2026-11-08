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


## Saved driver identity — 8 November 2026

- Added an editable driver-name field to Race Control. The name is saved in the existing device-local racing data record, without changing the storage key or version, so existing save slots and high scores remain readable.
- New save slots use the driver's name; completed local high-score entries capture the name at finish. Older records without a name remain valid and display as Driver.
- The game session bar identifies the active driver. Name persistence is device-local and is not represented as account-wide or server-synced identity.
- QA: set a name, refresh, confirm it remains; create a new save and verify the slot label; complete a race and verify the high-score entry shows the saved driver; load an older save and confirm it still works.
- This change is isolated to the racing menu's local data/UI. No driving physics, controls, camera, track, collision, pit movement, race timing or PWA assets are changed.


## Garage car paint — 8 November 2026

- Added six paint choices to the existing starting garage: pink, racing red, blue, yellow, white and graphite.
- The selected paint is applied to the player's procedural 3D car and saved locally under a separate versioned key. Existing race saves and high scores are untouched.
- If browser storage is unavailable, colour selection still works for the current session and does not block gameplay.
- QA: choose each colour in the pit garage, confirm the car body changes immediately, refresh/reopen and confirm the last choice is restored; verify wheels, glass, lights and Kago retain their own materials.
- Visual-only garage addition. No vehicle physics, steering, throttle/brake/NOS inputs, camera, track, collision, pit movement, session timing or PWA cache behavior changed.


## Collapsible garage setup — 8 November 2026

- Added an accessible show/hide control to the existing ready-phase garage briefing. Tyre and paint choices, engineer note and checklist can be collapsed to reduce visual clustering before driving.
- Setup starts expanded so first-time players still see the available choices. The collapsed summary keeps the selected tyre and paint visible; reopening restores the same controls.
- This is presentation-only. It does not change phase transitions, pit-lane movement, driving controls, physics, camera, track, collision handling, race timing, saves, or PWA caching.
- QA: on the garage screen, collapse and reopen setup; confirm tyre and paint selections remain unchanged; start driving with setup either open or collapsed and confirm the existing controls and pit exit behave exactly as before.
- Source review only; automated checks, production deployment and device gameplay QA remain outstanding.


## Racing HUD toast placement correction — 8 November 2026

- Follow the HUD decision recorded in AGENTS.md: the 3D scene remains clean; the map stays in the upper-right; the persistent driving signal remains its own top guidance layer; transient event toasts render only in the dedicated notification strip immediately below the 3D scene and above NOS.
- The notification strip reserves vertical space so a toast does not cover the road or controls or cause the game viewport to jump. Toast text wraps naturally, is not clipped or line-clamped, and retains `role="status"` with `aria-atomic="true"`.
- Removed the obsolete canvas-overlay toast placement and its map-width reservation/clipping effect. Kept the existing map and signal-chip positioning, game loop and driving controls unchanged.
- Reverted the newly added collapsible starting-garage presentation for this QA pass. Starting tyre and paint choices remain expanded; the collapsible garage work is deferred until the product owner has approved the HUD.
- Bumped both service-worker cache identifiers from v50 to v51 so installed PWAs can fetch the updated racing JS/CSS.
- QA: inspect narrow portrait and landscape; confirm toast appears below the 3D scene and above NOS, wraps without clipping, never covers map/road/controls, and the scene height stays stable with and without a toast. Verify signal chip and map remain in their own lanes. Then test event messages and refresh an installed PWA to confirm v51 assets.
- Pit-time reopening of setup/paint is recorded as a separate follow-up and is not changed in this HUD-only pass.
- Source changes only; build, Vercel deployment and physical device gameplay QA must be reported separately.


## Circuit fence footprint collision — 8 November 2026

- Compared Vula's circuit against Big Brothers: both use the same 13-point Catmull–Rom centreline, 12-unit road ribbon, fence rails centred 8.4 units from the centreline, and the established 7.15-unit aligned-car collision envelope. Vula retains its additional physical pit connector and separate pit-road boundary.
- Centralised the shared track/fence/pit dimensions in `racing-track.ts` so the rendered rail positions and authoritative collision solver cannot silently drift apart.
- Kept the established 7.15-unit main-circuit and 3.5-unit pit-road clearance for a car aligned with the road. The solver now also accounts for the rotated car body's actual length and width: when the car is sideways in a drift, the safe centreline offset tightens enough to keep the front/rear corners from visually crossing the rail. Tangential motion remains available and barrier contact remains recoverable.
- The change is confined to track-boundary geometry and collision clearance. It does not alter the steering model, acceleration/braking, grip tuning, camera, track centreline, lap timing, Kago movement, saves or pit route state transitions.
- Bumped the service-worker game and shell caches to v52 so installed PWAs can fetch the updated game code.
- QA: test both sides of the circuit at shallow and near-perpendicular impact angles, including sustained drift along the fence; confirm the chassis stays on the driving side, slows/rebounds without snapping to another track segment, and can reverse away. Repeat through pit entry, the service lane and pit exit. Test portrait, landscape and a refreshed installed PWA.
- Source change only until automated checks and a current production deployment are confirmed; do not treat the code merge itself as physical gameplay QA.


## Production build retry — 8 November 2026

- Circuit/fence footprint correction and HUD toast placement correction are merged to `main`.
- GitHub Actions passed for the circuit/fence change (TypeScript, lint, identity/PWA checks and production build).
- Trigger a fresh production deployment from this commit after the Vercel daily deployment-rate limit blocked the prior automatic deployment. This commit changes documentation only; it does not change gameplay code.
