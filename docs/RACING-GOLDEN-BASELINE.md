# Vula Racing — Golden Baseline

**Status: APPROVED / PROTECTED REFERENCE**

## Exact rollback point

- Commit: https://github.com/gatshaayanda/vulas-car-wash/commit/2cbf7c1b8280094cb62d0854a8e4d3d2458a6ec9
- Reference branch: `golden-baseline/ai-race-2026-11-03`
- Production: https://vulas-car-wash.vercel.app
- Deployment state at approval: READY
- Approved: 2026-11-03

This is the approved Vula homepage AI Racing foundation. Keep this commit and reference branch as the sole rollback point. Do not reintroduce superseded checkpoints or branch references into current documentation. Never rewrite or force-push the reference branch. Future development happens on top of this baseline; if a change regresses the experience, restore this exact commit before proceeding.

## What is protected

- Existing player vehicle movement, steering, acceleration, braking, reverse, NOS and drift feel.
- Existing chassis-aligned chase camera and car presentation.
- Existing player rear-tyre smoke and skid-mark effects.
- Existing track geometry, road/barrier presentation and recoverable track-edge collision.
- Player-to-Kago chassis contact response added in the golden commit.
- Existing homepage Quick Break placement, Easy / Normal / Hard selector and mobile controls.
- Existing PWA installation/offline behavior and `/api/racing` account-backed persistence.

No physics-engine migration, control redesign, camera rewrite, visual restyle or unrelated racing-garage/career change is allowed as part of an AI feature.

## Vehicle parity

Kago's visible vehicle scale now matches the player (0.82), and its oriented collision footprint uses the same half-extents (1.52 × 0.89). Neither car is intentionally smaller.

## Current AI implementation — honest inventory

Kago now has an independent world-space driving model. The track spline is a navigation/progress reference, not his movement rail:

- Kago has an independent world-space driving model; the spline is a navigation and progress reference, not a movement rail.
- Easy / Normal / Hard target 16.65 / 17.9 / 18.8 world-units/second on the player's speed scale: Easy is about 7% slower, Normal approximately equal, and Hard about 5% faster before its short NOS burst.
- The bot engine, braking and drag model must match the player's established force scale closely enough to reach the advertised target pace. An underpowered bot that cannot overcome drag is a gameplay defect.
- Kago uses relative world position to select passing/defensive lines, with smooth lane transitions and difficulty-specific corner confidence.
- The player and Kago use matching visible car scale (0.82) and matching collision half-extents (1.52 × 0.89).

## Implementation status — independent Kago AI (2026-11-03)

Implemented in the first additive gameplay pass (commit pending QA):
- Kago now has independent world-space position, velocity, yaw, steering, throttle, braking, slip, and finite NOS state. The original track spline is used for look-ahead navigation, local projection/lap progress and gradual road-envelope recovery; it no longer directly places the rendered car.
- Initial AI corner planning uses a speed-dependent look-ahead point, shared track-turn curvature, throttle/brake decisions and a bounded road envelope.
- Initial virtual racing-line variation chooses a normal offset and context-dependent defensive/attacking offsets when the player is close. This is an initial tactical lane choice, not yet a full F1-style passing planner with side-by-side overlap prediction and multi-corner strategy.
- Kago receives a reciprocal, mass-biased impulse during player contact. A bounded spark pool emits short bursts for sufficiently strong impacts with a cooldown.
- Kago has separate slip telemetry, bounded skid/smoke resources, and an independent NOS reserve/boost state with a visible exhaust flame.
- The player's physics/control path was not refactored. The existing player car remains the reference implementation; bot movement uses adapted world-space velocity/yaw integration and its own AI decisions.

Still requires live QA and likely tuning:
- Validate bot cornering, line transitions, recovery, contact, sparks, independent skid/smoke and NOS on desktop and mobile.
- Tune AI steering/braking gains and the Easy/Normal/Hard pace targets against actual lap times and race gaps; these are initial simulation targets, not verified lap-time parity.
- Add a fuller side-by-side overlap and closing-speed pass commitment model, controlled mistakes and multi-corner racecraft.
- Confirm no performance regression from bot projection/effects; then continue difficulty personalities and presentation.
- Online multiplayer remains out of scope for this local AI pass.

## Approved additive development roadmap

1. Collision feedback and reciprocal contact: pooled sparks at real impact points; restrained reciprocal impulse to Kago.
2. Independent bot driving model: separate world-space position/velocity/yaw and steering, throttle, braking, slip, progress and recovery state. Spline becomes navigation reference, not movement rail.
3. Multiple virtual racing lines: baseline, defensive and attacking/overtaking lines derived from the one canonical track centreline, with smooth transitions and road-edge clearance.
4. Tactical racecraft: sense player position, relative speed, overlap, closing rate and road width; choose to defend, challenge, pass, yield or back out. Aggressive but not reckless.
5. Independent bot drift/skid/smoke effects driven by Kago's actual slip.
6. Independent finite bot NOS with tactical use and visible exhaust; never share player NOS state.
7. Difficulty personalities: pace, braking, corner commitment, line choice, aggression, mistakes, recovery and NOS strategy.
8. Grid/start/position/lap presentation and full local QA across difficulty, contact, racecraft, recovery, effects, pause/resume, restart, mobile and offline.
9. Online multiplayer only after local racing is reliable; separate architecture/cost approval, room codes, matchmaking/reconnect, authoritative validation.

## Multiple racing lines — design decision

Use one canonical physical track spline for circuit geometry, lap progress, navigation and boundary references. Derive multiple *virtual racing lines* from it using corner-specific lateral offsets and alternative entry/apex/exit profiles. Kago can choose a normal, defensive or attacking line according to the player's position, relative speed and available road width, then blend smoothly between them. This gives varied, tactical driving without creating conflicting physical tracks or boundary solvers. Separate canonical splines are appropriate only when building genuinely different track layouts.

## Difficulty calibration — current baseline

- Easy target: **16.65 world-units/second** (about 7% below Normal).
- Normal target: **17.9 world-units/second** (matched to the player's 230 km/h world-speed cap).
- Hard target: **18.8 world-units/second** (about 5% above Normal before NOS).
- These are independent bot speed caps, not km/h or guaranteed lap-time outcomes. Validate achieved speed, corner speed, lap times and race gaps in actual play.
- Kago uses independent world-space velocity/yaw; player physics remains untouched. Difficulty must feel distinct through corner confidence, braking, racecraft, recovery and NOS use—not by changing the player's controls.

## Non-negotiable implementation rules

- Keep each stage isolated and additive. One feature per change set.
- Never change the protected player driving model to make the bot easier to implement.
- Reuse the existing track and coordinate system. Do not introduce a second competing collision solver.
- Bot effects and bot resources must have independent state and object pools.
- Keep render-loop allocations bounded; use pooled particles and bounded geometry buffers.
- Preserve player-vs-bot contact, track barriers, camera, mobile controls, service-worker caches, PWA install behavior and `/api/racing`.
- Do not claim an AI capability exists until it is implemented and tested in the live game.
- If QA finds a regression, revert to the exact golden commit above and re-implement the feature more narrowly.
