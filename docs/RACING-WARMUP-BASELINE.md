# Vula Racing Warm-up — Approved Baseline

This is the current product-owner-approved baseline for the solo circuit warm-up. Improve it incrementally; do not replace the driving experience or redesign unrelated app infrastructure.

## Preserve

- The current circuit layout, 3D environment, trackside scenery, brake/turn-in markers, kerbs, barriers, chase camera, HUD, lap timing, countdown, pause/restart flow, and responsive layout.
- The existing mobile/keyboard control inputs and button behaviour: steering left/right, accelerator, brake, and tap-to-toggle NOS. Keep the current control layout and input semantics unless the product owner explicitly authorizes a change.
- Offline/PWA and installation infrastructure. Racing changes must not touch the approved installation mechanism, manifest, icons, service worker, or cache namespaces.

## Vehicle handling and collision rules

- The car owns its world-space position, velocity, and yaw. Circuit projection is used only for lap timing, track limits, and collision queries; it must never advance or pull the car along the track.
- Continuous analog steering changes the car trajectory through speed-dependent yaw and available tyre grip. The steering stick must directly set a signed continuous steering input, and release must return it to centre. The player may miss corners, leave the circuit, and recover by driving back onto it.
- Barrier impacts are graduated by impact velocity: minor contact should cost speed, stronger impacts should add damage, and only a severe/disabled crash ends the run. Never pit-respawn for a routine scrape.
- Racing-line cues are advisory only and must not add automatic throttle, steering, or exit boosts.

## Warm-up handling rules

- The player is practising alone. No AI rivals, traffic, forced slipstream, scripted boost, or environmental effect may activate unless the player input or a real gameplay interaction triggers it.
- Steering should produce a smooth, predictable line change. Ordinary well-controlled cornering must not trigger exaggerated skids, spins, or unwanted “skrrr” effects. Slides should only emerge from actual excessive steering/speed/braking demand, not from track curvature alone.
- This is a warm-up, not a crash challenge. Do not interrupt play with crash animations, automatic pit recovery, or control resets. A genuinely wide line may invalidate a lap, but must not take control away from the player.
- Do not place traffic cones or collision obstacles on the warm-up circuit. Existing scenery silhouettes (such as tree crowns and distant hills) are scenery, not obstacles.
- NOS remains explicitly player-triggered and visibly consumes/recharges its meter according to existing rules.

## Visual customization

- The current pink-red, rounded-body car is the approved visual direction. Car styling may improve independently, but must not change car handling, control inputs, track geometry, environment layout, camera, or HUD.
- Avoid network-dependent model swaps that cause the car to change appearance between online/offline sessions.

## Mobile control ergonomics

- Use a circular, two-dimensional thumbstick in the left-thumb zone, following the familiar movement-stick pattern from Shooters Trigger and Paws World. The knob follows the thumb within a circular boundary; horizontal displacement continuously steers the car. Brake is the left pedal and gas the right pedal in the right-thumb zone, separated from steering by a clear gutter. NOS is a compact, dedicated button beneath the pedals—not a full-width bar.
- Preserve reliable pointer capture and release, large touch targets, visible pressed states, and keyboard parity. The circular stick must visually return to centre on release. Keep frequent controls reachable near the lower screen corners and reserve upper-screen space for HUD/menus.

## Verification gate

Before asking for QA, inspect the actual diff, verify protected installation files were not changed, run the production build/typecheck where available, and confirm the latest Vercel deployment is READY. Report build/deployment status honestly; do not call a push alone QA-ready. Device playtesting remains a separate check.
