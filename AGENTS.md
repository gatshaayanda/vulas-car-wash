# Vula's Car Wash — project instructions

## Source of truth
This is an existing customer-facing PWA adapted from the approved Iteration 13 foundation. GitHub `main`, this file, `README.md`, current Firebase rules and actual CI results are the source of truth. Preserve working PWA installation/offline behavior and implement the real Vula workflow in place; do not reclone the foundation.

## Product requirements
- Customer-first experience, staff operations second.
- Fixed-site booking and walk-in queue at the configured site; mobile service is a request until staff confirm coverage and capacity.
- Support individual customers and fleet enquiries.
- Service catalogue, gallery, customer booking history, loyalty balance, reminder preferences and live staff operations.
- Seed only known identity (Vula's Car Wash) and editable settings. Keep unconfirmed hours, address, prices, coverage and capacity as placeholders.
- No fake payment success. A customer can request online payment instructions, but payment gateway integration is not configured. Staff may mark payment only after verification.
- No fake booking confirmation. Requests are `requested` until staff confirm them.

## Current architecture
- Next.js App Router, TypeScript, Firebase Auth, Firestore, Firebase Storage, Firebase Cloud Messaging, service worker.
- Customer home: `src/app/page.tsx`; customer Firebase data layer: `src/lib/firebase/vula-data.ts`; push registration: `src/lib/firebase/vula-notifications.ts`.
- Staff route: `/admin`; gate: `src/app/admin/admin-gate.tsx`; operations: `src/app/admin/vula-dashboard.tsx`.
- Staff sign-in uses `/api/operations-login`, `FIREBASE_ADMIN_KEY`, and `VULA_OPERATIONS_WORD`. Never expose service-account credentials or staff secrets to the client.
- Collections: `admins`, `customers`, `services`, `gallery`, `businessSettings`, `bookings`, `queueEntries`, `fleetRequests`, `loyaltyAccounts`, `reminderPreferences`, and `notificationTokens`.
- Firestore authorization is in `firestore.rules`; image access is in `storage.rules`; indexes are in `firestore.indexes.json`.
- `public/sw.js` uses isolated, versioned `vula-shell-v4` and `vula-game-v4` caches. It precaches the public game route, discovered Next.js assets, and the selected local racing model when available; the procedural car remains the offline fallback. Bump cache versions when shipped game assets change. Keep early `beforeinstallprompt` capture and the explicit branded install click intact. Updates must wait for the existing app's Refresh action; do not force-reload during install. iOS installation guidance is at `/iphone-install`.
- Legacy foundation routes redirect to the active customer or staff journey via `src/middleware.ts`.

## Online/offline rules
- Firestore client persistent cache is enabled.
- Offline booking/queue/fleet drafts are stored locally and retried with a stable document ID after reconnection or app reopen. Do not say the staff received them until the server write succeeds.
- A submitted request is not a confirmed booking. Only staff confirmation changes booking status.
- Anonymous Auth lets customers begin without forced registration. Linking an anonymous session to Google preserves its UID. Explain that unlinked guest data remains device/session dependent.
- Push reminders require `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, registered customer tokens, `FIREBASE_ADMIN_KEY`, `VULA_REMINDER_CRON_SECRET`, and GitHub Actions secrets for the scheduled job. Only confirmed bookings should receive reminders.
- Gallery uploads require the Firebase Storage rules to be published.
- Vula Racing gameplay must remain playable offline after the game has been opened/cached online. The service worker caches the public game route and local racing model assets; offline race results remain device-only and must never be represented as trusted server rewards. The app update prompt lets the user refresh into a waiting service-worker version.
- Vula Racing stores device-local progress for offline play and uses `/api/racing` for authenticated server persistence. The route verifies Firebase ID tokens, scopes career profiles to the caller UID, applies upgrades and race rewards on the server, validates server-created race sessions, and exposes only alias/track/result summaries to the staff view. The `racingProfiles`, `racingResults`, and `racingSessions` collections are accessed by the Admin SDK, not directly by clients; keep them denied in client Firestore rules. Offline-only race results are not queued for later trusted reward submission. The `/admin` Games tab controls availability/notices and loads server-stored profiles/results only for authorized staff.
- Do not claim Firebase rules/indexes or production deployment are live just because their files are committed.

## Implementation and verification
- Inspect the actual current code and relevant Firebase rules before changing data contracts.
- Keep Firestore rules aligned with the fields written by `src/lib/firebase/vula-data.ts` and the customer forms.
- Never loosen rules to public reads/writes to silence permission errors. Customers may read/write only their own records and preferences; loyalty balance, catalogue, gallery, settings and operational updates are staff controlled.
- Run `npm run verify:identity`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` where feasible. Inspect GitHub Actions results and fix regressions caused by changes.
- Protect secrets, avoid fake success messages, and report separately: code committed/pushed, checks passed, Firebase rules/indexes deployed, production deployment verified.
- At handoff, include exact commit, remaining configuration, known limitations and device QA steps. The product owner handles Vercel deployment unless explicitly delegated.

## Protected Vula Racing golden baseline

- **Only current approved golden baseline:** commit `2cbf7c1b8280094cb62d0854a8e4d3d2458a6ec9`, reference branch `golden-baseline/ai-race-2026-11-03`.
- This is the authoritative rollback and development foundation for Vula Racing. Do not substitute an earlier checkpoint, implementation, or superseded reference. Do not bring obsolete baseline identifiers, branch names, or deployment claims back into current instructions, code comments, docs, or handoffs.
- Never move, delete, rewrite or force-push the approved golden reference branch. Develop forward from this exact approved baseline on a working branch. If a feature regresses, restore this exact approved commit.
- The approved baseline includes the initial independent Kago AI implementation and its known limitations. Do not describe the bot as race-ready merely because independent state exists; it must accelerate to advertised pace, take corners convincingly, contest position and recover reliably in actual play.
- Preserve the approved player vehicle physics, steering, acceleration, braking, reverse, drift, NOS, camera, controls, car presentation, track geometry, barriers, collision response, PWA behavior, Race Control save menus and online persistence.
- Never reduce or rewrite player physics to compensate for bot tuning. Tune the bot's own acceleration, braking, steering, grip, speed control, racecraft and effects independently.
- Do not mix unrelated player-driving refactors with AI work. Keep changes isolated, additive and independently QA-able.
- Track-only work must remain isolated to track geometry, barrier visuals and collision/track-boundary handling. Do not regress the golden driving feel while changing track behaviour.
- Barrier contacts during practice must remain recoverable. Never force a game-over, disable controls or respawn the player because of a normal track-edge collision.
- Use one authoritative track-boundary solver. Do not add competing render-loop collision corrections that can disagree with the driving simulation at curved segment joins.

## Racing opponents roadmap (approved direction)

### Homepage Quick Break — current opponent
- The customer-facing experience is the **VULA RACING · QUICK BREAK** card on the homepage, with “Take a quick lap” and “Play now”. It is rendered by `src/app/games/racing-warmup.tsx` inside `src/app/page.tsx`; its 3D scene is `src/app/games/racing-3d-scene.tsx`, track construction is `src/app/games/racing-track.ts`, and styles are `src/app/games/racing-warmup.css`.
- All Quick Break bot work belongs in this flow. Do not substitute Racing Garage or `/games/career`.
- Kago currently follows the circuit spline at a pace target. His rendered position and heading are derived from that spline. He is not yet an independently controlled driver.
- Kago's visible car scale and oriented collision footprint match the player (0.82 render scale and 1.52 × 0.89 half-extents). Easy / Normal / Hard target 16.65 / 17.9 / 18.8 world-units/second on the player's speed scale (Easy ~7% slower, Normal approximately equal, Hard ~5% faster before NOS). Acceleration/braking are calibrated closer to the player's force scale. Relative world-position sensing now drives smoothly blended passing/defensive lines, and corner confidence varies by difficulty.
- The player and Kago currently use different movement representations: the player integrates world-space velocity and chassis yaw, while Kago advances a scalar spline progress value. Do not compare the displayed player km/h directly with Kago's spline pace as if they were the same telemetry unit.

### Protected development sequence
1. **Collision feedback and reciprocal contact:** add a short, pooled spark burst at the real chassis contact point and a restrained, mass-aware impulse to Kago. Preserve the current collision solver and player feel. Sparks must occur only on actual contact, with intensity based on relative impact speed; avoid continuous sparks from resting overlap.
2. **Independent Kago driving model:** introduce a dedicated bot state (world position, world velocity, yaw, steering, throttle, brake pressure, slip, damage/recovery state and lap progress). Give Kago independent steering, acceleration, braking, corner planning and recovery. Keep the current spline as his navigation reference and progress/track-awareness source—not as his movement rail. Do not refactor the player's golden physics to share code; extract only safe, small shared math/helpers if proven behavior-neutral.
3. **Racing-line and tactical variation:** build multiple *virtual racing lines* from the existing track centreline. These are alternative paths/offset profiles, not multiple physical tracks and not a replacement track mesh:
   - baseline/normal line;
   - defensive line that moves toward the inside to protect position;
   - attacking/overtaking line that moves toward the outside or chooses a passing side;
   - alternative entry/apex/exit profiles for selected corners.
   Blend between lines smoothly and only when there is room. Keep a safe road-envelope constraint and collision-aware line selection. The centre spline remains the shared track coordinate/navigation reference.
4. **Racecraft and opponent awareness:** add look-ahead sensing for player position, relative speed, side-by-side overlap, closing rate, braking zone and available road width. Kago should choose when to defend, challenge, yield, attempt a pass or back out. Aggression must be contextual and bounded—not random ramming. Do not claim F1-grade intelligence; target readable, believable racecraft with deliberate decisions.
5. **Bot effects and telemetry:** calculate Kago's own chassis-versus-velocity slip and drive independent bounded skid/smoke effects from it. Player and bot effect state/pools remain separate. This stage follows real bot motion; never copy the player's drift values.
6. **Independent bot NOS:** give Kago a separate finite reserve, cooldown/recharge rules, tactical use on straights, to attack or defend, and visible exhaust response. It must never read or drain player NOS.
7. **Difficulty personalities:** retain the current pace values as initial calibration targets, then make each level meaningfully different through pace, braking confidence, corner commitment, line choice, racecraft aggression, mistake frequency, recovery skill and NOS strategy. Easy is safer and more forgiving; Normal is balanced; Hard is sharper and more assertive but still obeys grip, track limits and collision rules. Tune from lap-time, error and race-gap distributions rather than speed alone.
8. **Race presentation and local QA:** improve grid placement, synchronized starts, position changes and lap comparisons. Test all difficulties, repeated laps, side-by-side contact, defensive/attacking line changes, off-track recovery, collisions, drift, NOS, pause/resume, restart, mobile controls and offline launch.
9. **Online multiplayer:** only after local races are reliable, plan a persistent multiplayer service separately (Colyseus remains a candidate). Room codes first, then matchmaking/reconnect/presence; authoritative server validation before shared results/leaderboards. No multiplayer service, credentials, deployment or recurring cost without a separate plan and explicit approval.

### Multiple splines: implementation principle
- Do not create several competing copies of the physical circuit merely to make Kago less predictable. That would complicate track boundaries, barriers, collision checks, lap progress and camera/navigation consistency.
- Instead, derive a small set of racing-line curves or corner-specific lateral-offset profiles from the one canonical centreline. A line is selected per corner and tactical situation, with smooth transitions and road-edge clearance.
- For a later multi-layout feature, separate named track layouts can each own a canonical centreline and matching boundaries. That is a different feature from AI racing-line variation.
- Deterministic, state-driven choices with controlled variation are preferred over random spline switching. Kago should react to the player and current race situation, not repeat a fixed lap script.

### Non-negotiable protections
- Work only in `gatshaayanda/vulas-car-wash` for Vula Racing tasks unless the product owner explicitly names another repository.
- Preserve the approved golden player vehicle, steering, acceleration, braking, reverse, drift, NOS, camera, controls, collisions, track/barriers, effects, PWA install/offline behavior, Race Control save menus and `/api/racing` persistence.
- Never change player physics or controls to make the bot easier to implement. Keep bot simulation and resources independent.
- Never add a second competing track-boundary or collision solver. Reuse the canonical track coordinate system and authoritative collision path.
- Keep render-loop allocations bounded; use pooled particles and bounded geometry buffers.
- Never claim a bot capability exists until it is implemented and tested in the live game.
- Keep offline results device-only. Only server-verified results may enter shared leaderboards or award verified online credits.
- If QA finds a regression, revert the feature to the exact golden commit above and re-implement it more narrowly.
