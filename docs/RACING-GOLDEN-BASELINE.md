# Vula Racing — Golden Baseline

**Status: APPROVED / PROTECTED REFERENCE**

## Exact rollback point

- Commit: https://github.com/gatshaayanda/vulas-car-wash/commit/028367bde4c729d87e2bfe5c57e37b03e630af3b
- Reference branch: `golden-baseline/quick-break-2026-11-03`
- Production: https://vulas-car-wash.vercel.app
- Deployment state at approval: READY
- Approved: 2026-11-03

This is the known-good Vula homepage Quick Break racing experience. Keep this commit and reference branch as the rollback point. Never rewrite or force-push the reference branch. Future development happens on top of this baseline; if a change regresses the experience, restore this exact commit before proceeding.

## What is protected

- Existing player vehicle movement, steering, acceleration, braking, reverse, NOS and drift feel.
- Existing chassis-aligned chase camera and car presentation.
- Existing player rear-tyre smoke and skid-mark effects.
- Existing track geometry, road/barrier presentation and recoverable track-edge collision.
- Player-to-Kago chassis contact response added in the golden commit.
- Existing homepage Quick Break placement, Easy / Normal / Hard selector and mobile controls.
- Existing PWA installation/offline behavior and `/api/racing` account-backed persistence.

No physics-engine migration, control redesign, camera rewrite, visual restyle or unrelated racing-garage/career change is allowed as part of an AI feature.

## Current AI implementation — honest inventory

Kago is currently a **track-spline pace rival**, not a fully simulated driver:

- It follows the racing circuit spline at a fixed pace target.
- Easy / Normal / Hard currently change only the target pace: 11.5 / 14.5 / 17.5 world units per second; Normal is the default.
- Its speed target is reduced modestly by bend strength, with a smoothed speed response.
- Its position and heading are derived from the track tangent.
- The new car-to-car collision solver detects oriented chassis overlap, separates the player and applies a recoverable player velocity/speed response.
- The solver does not yet apply a reciprocal impulse to Kago, so the bot does not visibly get knocked aside.
- Kago does not yet make independent steering/throttle/brake decisions, recover from mistakes, overtake, drift, use NOS, or generate its own tyre effects.
- Player collision feedback currently includes speed loss/damage state and a notification, but **there are no visible impact sparks yet**.
- The smoke/skid effect system is currently driven by the player's drift state only; Kago has no independent drift trail.

## Approved additive development order

1. **Collision sparks and reciprocal contact:** add a short, pooled, low-cost spark burst at the actual contact point; add a restrained impulse to Kago so it visibly reacts. Preserve the current contact solver and player feel.
2. **Bot visual telemetry:** give Kago its own drift/slip state and separate bounded skid/smoke pools. Effects must be driven by bot motion, not copied from player state.
3. **Bot NOS:** add an independent finite NOS reserve, strategic activation on straights/when behind, visible exhaust flame and speed response. It must not drain or read the player's NOS.
4. **Driving AI:** progressively replace pure spline pace-following with steering, throttle and braking decisions, corner-speed planning, track awareness, controlled mistakes and recovery. Keep the spline as a navigation reference, not as the bot's movement rail.
5. **Difficulty tuning:** make Easy / Normal / Hard distinct in pace, braking confidence, corner speed, NOS frequency, mistake probability and recovery skill. Keep Normal as default and tune against measured lap-time/gap distributions, not arbitrary top-speed numbers alone.
6. **Race presentation:** improve grid placement, synchronized starts, position changes, lap comparisons and clear race feedback.
7. **Local QA:** validate repeated laps, all difficulty levels, collisions, drift, NOS, pause/resume, restart, mobile controls and offline launch before any online multiplayer work.

## Non-negotiable implementation rules

- Keep each stage isolated and additive. One feature per change set.
- Never change the protected player driving model to make the bot easier to implement.
- Reuse the existing track and coordinate system. Do not introduce a second competing collision solver.
- Bot effects and bot resources must have independent state and object pools.
- Keep render-loop allocations bounded; use pooled particles and bounded geometry buffers.
- Preserve player-vs-bot contact, track barriers, camera, mobile controls, service-worker caches, PWA install behavior and `/api/racing`.
- Do not claim an AI capability exists until it is implemented and tested in the live game.
- If QA finds a regression, revert to the exact golden commit above and re-implement the feature more narrowly.
