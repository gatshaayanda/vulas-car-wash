# Vula Racing — current release QA checklist

Use the production customer entry point: https://vulas-car-wash.vercel.app/ → Vula Racing → New Game. Only test a deployment built from the exact current `main` commit.

## Release gate

- Confirm the Vercel production deployment is `READY` and its source SHA matches the commit being tested.
- Confirm `npm run verify:identity`, `npm run lint`, `npx tsc --noEmit` and `npm run build` pass. Report each result separately; do not infer a build from a successful Git push.
- Confirm both service-worker caches are on the same version and the installed PWA can refresh into that version.
- Physical gameplay, mobile layout and offline launch are device checks; source review or a successful build does not count as those checks.

## Entry, saves and menu

- New Game creates a separate device-local save slot and opens the playable 3D pit scene, not a blocking full-screen setup.
- Driver name is attached to the save slot. Continue and Load restore that slot's driver identity, difficulty, best lap and valid latest qualifying record.
- Existing version-1 local saves without a per-slot driver name remain readable; infer the legacy name from the existing slot label.
- Pause, save, leave, reload and load an older slot. Confirm the selected slot is restored and no other slot or high-score record is overwritten.
- High Scores contains only completed local races, clearly labelled device-local and not server-verified.

## Session flow

- PIT MENU offers exactly Warm-up Laps, Qualifier and Start Race.
- Warm-up starts from the pit, is solo, and remains open-ended. Completing a lap does not automatically start qualifying.
- Qualifying starts alone from the grid. Kago may run an invisible benchmark, but no Kago car, name tag, map marker or collision is visible during qualifying.
- Qualifying completion saves the player time and Kago benchmark, returns the car to the pit and opens the PIT MENU. It must not start the main race automatically.
- The PIT MENU shows the latest qualifying time and whether it earned pole or second. The player explicitly chooses Start Race after reviewing it.
- A valid qualifying lap determines pole/second against Kago's benchmark. An invalid or missing qualifying result means the player starts last in a direct race.
- Direct race and qualifier-to-race transition use the same tight two-car grid just beyond the start/finish line. Kago appears only when the race begins.
- Main race is exactly two scored laps. Verify both win and loss result paths, result timing and return-to-pit flow.
- Kago's single strategic pit stop hides his car, name tag, map marker and effects while his own AI progress continues. The in-scene KAGO · IN PITS status appears and the car returns after service.

## Tyres, controls and driving

- Only Soft and Hard are offered; Medium is not present.
- Soft gives +5% forward acceleration and +8% speed cap for exactly the first scored race lap, beginning at green. It does not affect warm-up or qualifying and does not restart after a pit change.
- Hard gives 20% more available lateral grip and modestly stronger slip recovery. Drifting remains possible; the car must not be locked to its heading.
- Qualifying and main-race compounds are separate allocations. The race compound may differ from the qualifying compound.
- During a race, the player can make one actual compound change at the physical pit service bay. Selecting the fitted compound does not consume the replacement; after a real change, the replacement is locked.
- Warm-up tyre selection remains changeable in the pit. Paint choices update the player's car and persist locally.
- Test analogue steering and directional steering. Hold LEFT and RIGHT independently and together; confirm steering returns to neutral on pointer-up, pointer-cancel, lost capture and session reset.
- Hold GAS and BRAKE; verify each releases correctly if touch is interrupted. Tap NOS on/off, confirm depletion and lift-off recharge. Test keyboard controls too.
- Verify the in-scene HUD, map, persistent driving cue, notification strip, NOS meter and controls stay in their intended separate lanes and do not cover the moving 3D road.

## Track, pit and opponent

- Drive the physical pit entry and exit; confirm no teleport, forced steering, unexpected speed cap or loss of player control.
- Check track limits, both barrier sides, shallow and near-perpendicular contact, recovery/reverse, and sustained drift along the fence.
- Confirm Kago uses independent world-space movement, stays on track, brakes for corners, uses NOS and makes one pit stop. A speed target is not proof of competitive lap pace; compare measured full-lap times and corner speeds across Easy, Normal and Hard.
- Test Kago/player contact and ensure neither car becomes trapped or permanently disabled.
- Test portrait and landscape, including narrow mobile screens.

## Offline and online boundaries

- Open the game online once, then launch the installed/cached PWA offline and complete a playable session.
- Offline race results and high scores remain device-local. They are not queued as trusted server rewards.
- Verify authenticated online career persistence separately through the existing `/api/racing` flow. This does not imply real-time multiplayer rooms or matchmaking.
- Do not claim Firebase rules, server persistence, production deployment or offline behavior are live merely because their source files are committed.

## Current implementation notes

- The session flow, local saves, tyre allocations, directional steering, 3D scene and HUD are implemented in the current source. This checklist is the acceptance test, not evidence that those paths have passed physical QA.
- The product owner should only be asked to test after the exact `main` SHA has a successful production build/deployment. Report source review, automated checks, deployment, offline verification and real-device gameplay separately.
