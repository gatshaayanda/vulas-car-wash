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

- **Only current approved golden baseline:** commit `951e3af260f14e0fe647a8715bbe4328c210c349`, protected reference branch `golden-baseline/kago-racing-2026-11-04`. This is the version the product owner approved on 4 November 2026. All improvements must move forward from it.
- This is the sole authoritative rollback and development foundation for Vula Racing. Never substitute an older checkpoint or superseded implementation. If the product owner asks to go back, restore this exact baseline. Do not bring up obsolete versions, baseline identifiers, branch names, or historical deployment claims in discussion, code comments, docs, or handoffs.
- Never move, delete, rewrite or force-push the approved golden reference branch. Develop forward from this exact approved baseline on a working branch. If a feature regresses, restore this exact approved commit.
- The approved baseline includes Kago's independent world-space vehicle state, steering, throttle, braking, line selection, NOS and collision response. Its known outstanding defect is competitive pace: adequate engine force alone does not prove that Kago holds speed through corners or contests the player. Do not describe him as race-ready until full-lap gameplay QA proves it.
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
- Kago moves using his own world-space velocity and chassis yaw. The circuit spline is a navigation, look-ahead, track-awareness and lap-progress reference only; it must never directly move his car.
- Kago's visible car scale and oriented collision footprint match the player (0.82 render scale and 1.52 × 0.89 half-extents). Current bot-only base speed target is **24.11 world-units/second (approximately 310 km/h) shared across Easy, Normal and Hard before NOS**. NOS is difficulty-specific: Easy saves it for larger pace deficits and gets a short, modest burst; Normal uses it for pace recovery and genuine attack/defence opportunities; Hard commits sooner and more forcefully to attack or defend. NOS has a finite reserve, distinct drain/recharge rates, burst thresholds and cooldowns. These are target caps, not proof of achieved lap pace: braking, throttle continuity, line choice, overtaking and NOS must be validated over full laps. These are target caps, not proof of achieved lap pace: braking, throttle continuity, line choice, overtaking and NOS must be validated over full laps. Relative world-position sensing drives smoothly blended passing/defensive lines.
- The player and Kago both integrate world-space vehicle motion independently. Keep their physics separate. Compare measured lap pace and world-space speed, not a fabricated spline-speed equivalence.

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
7. **Three difficulty personalities:** Easy preserves the current enjoyable competitive setup; Normal actively challenges and overtakes the player; Hard is faster than the player, uses more aggressive but bounded racecraft, smarter/more frequent tactical NOS and stronger corner commitment. Differentiate through pace, steering response, braking confidence, line choice, passing/defending, recovery and NOS strategy—not speed alone. All levels must obey grip, track limits and collision rules. Tune from full-lap times, errors and race-gap distributions.
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


## Approved Kago track knowledge and race experience

- Kago must know how to drive each circuit before the player's first race on it. His baseline competence comes from predefined track knowledge, not from losing races and learning the circuit through the player's driving.
- The player learns each circuit through warm-ups. Qualifying establishes grid positions; the race then uses those positions and the opponents' existing knowledge to create a competitive event.
- Apply this consistently across the planned 12 tracks. Each track's driving knowledge is derived from its canonical spline: corner shape, braking/turn-in/apex/exit references and viable racing-line options.
- Kago may retain limited observations about the player's successful lines and previous encounters, but this is supplementary. Learning must never be required for him to race competently or challenge the player's fastest known line.
- Keep the implementation direct and bounded: corner-aware track model, a few derived racing lines, contextual attacking/defensive choices, opponent gap-trend awareness, and useful performance telemetry. Avoid an elaborate adaptive-AI framework, artificial rubber-banding or unrelated systems.
- Preserve the intended player journey: warm-up → qualifying → race → results. Reuse the same race engine as the game expands; do not create separate racing implementations for future divisions, career or online modes.
- This approved direction is separate from visual-only tasks. Do not start implementing Race Intelligence V1 unless explicitly requested.

## HUD visual scope protection

- The approved HUD addition is a compact live circuit map showing the canonical track layout and both actual car positions. Keep it subordinate to the road view and readable on mobile.
- The road's centre guide/racing line is intentionally removed. Do not reintroduce a painted racing guide line unless explicitly requested.
- For this visual task, do not alter vehicle physics, AI tuning, track geometry, barriers, collision handling, camera, driving controls, warm-up flow, save/persistence, PWA/offline behavior or race rules.


## Racing menu, save/load, Quick Race and high scores — immediate approved scope

- The current delivery order is fixed: **mobile-first main menu → New Game / Continue / Load Game / Save Game → existing 3D Quick Race with Kago → genuine completed-race results → High Scores**. Deliver this connected flow before adding any other racing feature.
- Quick Race must have an actual race completion condition and a result event. Capture elapsed race time, valid best lap, difficulty and player finish position from the simulation; do not invent or imply server verification.
- New Game creates a separate device-local save slot and starts the existing 3D Quick Race. Continue restores the active validated save. Load Game lists saved slots. Save Game is available from a paused state and persists a validated snapshot. Never overwrite a slot silently; preserve the last valid stored value if a write fails.
- Local save data uses a versioned, validated schema and device storage. High Scores contains only completed results. Clearly label records as device-local/offline, not shared leaderboard entries or rewards.
- Keep Kago's shared 310 km/h base target (24.11 world-units/second) and approved 3D player handling untouched. Do not refactor simulation or alter controls to implement menu navigation.
- Design portrait/mobile first: compact screens, thumb-reachable actions and readable touch targets.
- Do not add pit stops, tyre/fuel strategy, qualifying, divisions, career mode, online multiplayer or unrelated features in this delivery.
- QA must prove New Game, Continue, Load, Save/restore after refresh, completed race result recording, High Scores persistence and offline behavior on a phone. Report only checks actually run. Product owner handles Vercel deployment unless explicitly delegated.



## Racing entry point and QA contract
- The racing menu is the primary game entry point both when embedded in the homepage section `#vula-racing` and on the standalone `/games` route. The homepage must render `RacingMainMenu` (not `RacingWarmup` directly), so New Game, Continue, Load Game and High Scores are visible before Quick Race.
- Preserve the standalone `/games` entry while keeping the embedded homepage version mobile-first and contained within the Vula landing-page layout. Verify the actual homepage URL after deployment, not only `/games`.

## Formation lap, Kago difficulty and race finish (2026-11-05)
- Race format: one unscored formation/warm-up lap, then return both cars to the start grid, stop the warm-up clock, and launch a three-light countdown. Follow with exactly two scored race laps. The formation lap must not count toward race elapsed time, best lap, or the stored two-lap result.
- The player and Kago must both be reset to opposite grid slots at the start/finish line after the formation lap. Keep the existing player handling and speed caps unchanged.
- Easy, Normal and Hard share the same 310 km/h Kago base target. Difficulty is expressed through steering precision/response, corner confidence and mistakes, braking judgement, and attack/defend decisions. NOS must also differ materially: Easy uses it sparingly for a larger pace deficit and receives a modest burst; Normal uses it for pace recovery and attack/defence windows; Hard uses it more readily and gets the strongest burst for attacks, defence and pace recovery. Each level has its own reserve threshold, drain, recharge and post-burst cooldown. The player vehicle and player NOS are unchanged. Do not use hidden rubber-banding.
- The completed result records two scored laps and the player's finishing position. A win receives a distinct celebratory finish treatment; a loss receives a clear but restrained result treatment.
- Preserve offline play and local race-result/high-score integration. QA the complete formation → grid countdown → two-lap race → result flow on a phone, including Easy/Normal/Hard. These changes do not authorize online multiplayer or changes to player physics.


## Pit preparation, tyre choice and NOS strategy — approved QA scope

- The Quick Race pre-start screen includes a compact pit-garage briefing, a visual starting-tyre selection (Soft / Medium / Hard), a car-readiness checklist and a race engineer cue.
- **Tyres are presentation-only in this QA stage.** The selected compound must not alter grip, steering, braking, speed, wear, temperature, damage or lap timing. Do not imply mechanical tyre effects until a separate approved physics implementation is tested.
- Do not add fuel management. NOS is the race resource: it has a finite reserve, tactical tap-to-toggle burst, drain while active and passive recharge (faster when the player lifts off). Show the reserve clearly and communicate deployment/depletion without repeated toast spam. Kago has an independent NOS reserve and strategy; never couple it to the player's meter.
- The pit briefing leads into the existing formation lap, grid reset/countdown and two scored laps. Preserve those race rules and existing save/result contracts.
- Kago's line selection may use bounded, deterministic corner-entry/apex offsets and tactical inside/outside choices. Smooth transitions, maintain road clearance and use the canonical track spline; do not add alternate physical tracks or a second collision solver.
- Keep communications grounded in real simulation events: persistent signal chip for current driving cue, short event toast for important changes, and concise contextual engineer copy. Suppress repetitive messages and do not stack competing alerts.
- Preserve the approved player handling, controls, Kago 310 km/h shared base target, NOS difficulty profiles, offline gameplay and local-only offline results.
- QA must cover tyre selection, pit-to-formation start, NOS deployment/cancellation/recharge/depletion, all three AI difficulties, corner-line behaviour, race completion, save/restore, mobile controls and offline launch. Report only checks actually run.

## Menu vehicle graphics experiment — scope boundary

- The live menu preview remains the safe place to compare procedural and imported Kenney Racing Kit vehicles. Do not replace the in-race player or Kago models as part of a menu-only experiment.
- Use only models produced by the repository's prepare:racing-assets build step and preserve the procedural fallback when the manifest, model, WebGL or offline asset is unavailable.
- Keep the existing circuit, preview camera and animation. Cache any newly selected local model and its dependencies before claiming offline graphics support.
