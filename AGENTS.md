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
- `public/sw.js` uses isolated, versioned `vula-shell-v34` and `vula-game-v34` caches. It precaches the public game route, discovered Next.js assets, and the selected local racing model when available; the coloured procedural car remains the offline fallback. Bump cache versions when shipped game assets change. Keep early `beforeinstallprompt` capture and the explicit branded install click intact. Updates must wait for the existing app's Refresh action; do not force-reload during install. iOS installation guidance is at `/iphone-install`.
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

- **Only current approved golden baseline:** commit `0d440cd3a63220ee99559abe13fffb45e61180cf`, protected reference branch `golden-baseline/vula-racing-2026-11-06`. This is the version the product owner approved on 6 November 2026. All improvements must move forward from it.
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


## Racing menu, garage, Quick Break race and high scores — current approved scope

- The delivery order remains: **mobile-first main menu → New Game / Continue / Load Game / Save Game → existing 3D Quick Race with Kago → genuine completed-race results → High Scores**. Keep the homepage VULA RACING · QUICK BREAK card as the customer-facing entry point and preserve the standalone `/games` route.
- The current approved race journey supersedes the older formation-lap instructions: **pit garage and starting-tyre choice → solo practice lap → qualifying lap → grid set from qualifying time → two scored race laps with Kago → one mandatory pit-lane visit and tyre selection → finish and results**.
- During solo practice, Kago must be absent from the visible circuit, including his name tag, and must not collide with or obstruct the player. The player learns the controls alone: hold GAS while moving the left thumbstick left and right. Keep a persistent, concise signal chip and short, event-based toasts to coach the player; do not rely on a brief one-time message alone.
- During qualifying, Kago remains visually absent. The player's valid qualifying lap time determines the grid order against Kago's qualifying benchmark/time. Never decide pole position from bot progress, a hard-coded player-first flag, or whether Kago happens to be ahead at the finish line. Make the comparison visible in the qualifying/grid feedback. Invalid qualifying laps do not earn pole.
- Kago appears on the grid only when the two-lap race begins. The race has exactly two scored laps. Kago uses his own world-space driving state and independently makes one strategic pit stop during the race.
- **The player must physically drive through the open pit-lane entry. There is no PIT NOW button and no manual pit request.** Keep the pit lane physically connected to the circuit, clearly marked, and open through the barrier. Use the same canonical pit-lane curve for the 3D road, map, entry detection, service bay, and exit. Do not teleport a player who is still on the racing line into the pit.
- Give clear advance pit-in signalling/toasts and a visible PIT IN entry marker. When the car reaches the pit service bay, show a compact, non-blocking GGL-style proximity interaction over the 3D scene with Soft / Medium / Hard tyre choices. The car remains under normal world-space physics and player control while the panel is open; selecting a tyre closes the panel and shows a short animated PIT CREW confirmation toast. Do not require a full stop, pause the race, reset momentum/controls, spline-steer, impose a pit speed cap or teleport the car. Keep the mandatory pit-visit requirement: tyre selection counts only after the player physically exits the pit lane.
- The player and Kago must not block or collide with each other in the pit lane or service box. Pit-lane service must remain usable if both cars pit at the same time. Keep each driver to one stop.
- **Tyres are presentation-only in this QA stage.** Starting and pit-stop choices must not alter grip, steering, braking, speed, wear, temperature, damage or lap timing. Do not claim tyre strategy/physics until separately implemented and tested.
- Do not add fuel management. NOS is the race resource: finite reserve, tactical tap-to-toggle burst, drain while active and passive recharge (faster when the player lifts off). Show the reserve clearly and communicate deployment/depletion without repeated toast spam. Kago has an independent NOS reserve and strategy; never couple it to the player's meter.
- Preserve the approved player handling, steering, acceleration, braking, reverse, drift, NOS, camera, controls, track geometry, barriers, collision response, save/result contracts, PWA installation and offline gameplay. Never change player physics to compensate for AI or pit-lane issues.
- New Game creates a separate device-local save slot; Continue restores the active validated save; Load Game lists slots; Save Game is available while paused. Never overwrite a slot silently and preserve the last valid value if a write fails. High Scores contains only genuinely completed results, labelled device-local/offline and not server-verified.
- The result records the two scored race laps, elapsed race time, valid best lap, difficulty and actual finish position. A win receives a distinct celebratory finish treatment; a loss receives a clear but restrained result treatment.
- Keep the UI portrait/mobile first, with thumb-reachable actions and readable touch targets. Do not display misleading steering percentages or the obsolete “Move thumb to steer” caption; the control instruction should tell players plainly to hold GAS and sweep the left thumbstick.
- QA must cover garage tyre selection, solo practice with Kago hidden, qualifying-time grid order, Kago appearing at race start, both race laps, physical pit entry, non-blocking proximity tyre selection, animated confirmation, manual exit/rejoin, no pit-lane blocking, all three AI difficulties, results/high scores, save/restore, mobile controls and offline launch. Report only checks actually run. Product owner handles Vercel deployment unless explicitly delegated.

## Child-friendly racing coach and accessible onboarding

- The first-time racing experience must be understandable to a young child (around age five) with minimal adult explanation. Use plain, short, positive words and one action at a time. Avoid jargon such as throttle, turn-in, compound strategy, qualifying, pole position and racing line in player-facing prompts. Technical HUD data may remain secondary.
- Coach the immediate action through a persistent, large, high-contrast signal chip and a short event-based toast. Examples: “PRESS & HOLD GAS ↑”, “FOLLOW THE YELLOW LINE →”, “STEER LEFT ←”, “STEER RIGHT →”, “BRAKE NOW ↓”, “PIT STOP! TURN LEFT ←” and “PICK A TYRE”.
- GAS is a hold-to-accelerate control, not a tap toggle. Instructions must say “press and hold”/“hold”; do not say tap GAS. The large green GAS button should be the clearest action target. Keep steering visually obvious and separate from pedals.
- After tyre selection, show a brief “DRIVE ON” confirmation; preserve immediate player control and never auto-move the car or replace its momentum.
- Give positive, specific encouragement for real milestones: first movement out of garage, practice completion, qualifying completion, pit stop completion and race finish. Celebrate effort as well as winning; never shame a child for losing or making mistakes.
- Toasts must be event-driven, not repeated every animation frame. Keep them readable for long enough to understand, avoid covering the steering/pedal controls, and keep the persistent cue visible after the toast disappears.
- Do not overwhelm the child with simultaneous objectives, dense instructions, unexplained metrics, or frequent alerts. During practice, prioritize holding GAS and steering left/right. Introduce braking only when a corner is approaching, then the pit stop when the race requires it.
- Preserve existing car physics, input semantics, race sequence, mandatory physical pit-lane visit and tyre selection, save/results, PWA and offline behaviour while improving coaching copy and presentation.

## Race format and Kago difficulty (current)

- Easy, Normal and Hard share the same 310 km/h Kago base target (24.11 world-units/second). Difficulty is expressed through steering precision/response, corner confidence and mistakes, braking judgement, and attack/defend decisions. NOS must also differ materially: Easy uses it sparingly for a larger pace deficit and receives a modest burst; Normal uses it for pace recovery and attack/defence windows; Hard uses it more readily and gets the strongest burst for attacks, defence and pace recovery. Each level has its own reserve threshold, drain, recharge and post-burst cooldown. Player vehicle and player NOS remain unchanged. Do not use hidden rubber-banding.
- The completed result records exactly two scored race laps and the player's actual finishing position. Keep local-only offline results and the existing save/high-score integration.
- Kago's line selection may use bounded, deterministic corner-entry/apex offsets and tactical inside/outside choices. Smooth transitions, maintain road clearance and use the canonical track spline; do not add alternate physical tracks or a second collision solver.
- Keep communications grounded in real simulation events: persistent signal chip for current driving cue, short event toast for important changes, and concise contextual engineer copy. Suppress repetitive messages and do not stack competing alerts.

## Menu vehicle graphics experiment — scope boundary

- The live menu preview remains the safe place to compare procedural and imported Kenney Racing Kit vehicles. Do not replace the in-race player or Kago models as part of a menu-only experiment.
- Use only models produced by the repository's prepare:racing-assets build step and preserve the procedural fallback when the manifest, model, WebGL or offline asset is unavailable.
- Keep the existing circuit, preview camera and animation. Cache any newly selected local model and its dependencies before claiming offline graphics support.


## Menu-only Kenney vehicle graphics comparison — 2026-11-05

- The live main-menu preview may switch between the existing procedural player car and a prepared Kenney Racing Kit GLB/glTF vehicle loaded from the build-generated `public/game-assets/racing-kit/manifest.json`.
- This is a visual comparison only. Keep the existing preview circuit, camera, animation, bot, game physics, controls, race models and gameplay flow unchanged. The imported model replaces only the player car in the menu preview.
- Select a vehicle model by manifest metadata (prefer a car/vehicle/race filename); if the manifest or model cannot load, keep the procedural preview visible. Do not report imported-asset success unless the browser confirms the model loaded.
- The asset extraction runs as part of `npm run build`; generated manifest and model files are not necessarily present in the source branch before build. Offline caching of these generated assets must be verified separately before claiming the Kenney preview works offline.


## Racing PWA offline QA hardening — 2026-11-06

- Keep the homepage/game navigation and the selected local Kenney racing model available offline after an online visit. The active caches are isolated as `vula-shell-v34` and `vula-game-v34`; bump both versions whenever offline shell or game runtime behaviour changes.
- Next.js lazy-loaded JavaScript under `/_next/static/chunks/` belongs in the dedicated game cache, not only the general shell cache. This is essential because the embedded Quick Break scene and its Three.js dependencies load after the customer opens the game. Keep a generous bounded game-cache budget (currently 320 entries) so normal site traffic does not evict the racing runtime before offline QA.
- During service-worker installation, cache all route-discovered critical JS chunks and the public homepage/game routes. Continue caching the selected local Kenney model and any same-origin glTF buffers/textures; preserve the procedural vehicle fallback.
- Keep API requests network-only. Do not cache Firebase/API responses, customer account pages, admin pages, booking/queue data, authentication responses, or private user content as public offline assets. Offline race progress/results remain device-local and untrusted for online rewards.
- Offline QA sequence: visit the production homepage while online; allow the new service worker to install and activate; reload once so the page is controlled by it; open VULA RACING · QUICK BREAK and let the scene/model finish loading; then enable airplane mode or disable Wi-Fi/mobile data and reload the homepage before opening the game again. Verify the car, track, controls, practice/qualifying/race flow and pit stop still load. A first visit to a newly deployed worker may require that one reload after installation; do not claim offline readiness until this sequence is tested on a real device.
- Preserve the existing branded install prompt, waiting-worker Refresh flow, iOS install guidance, Firebase messaging isolation and all game physics/controls. Do not force a service-worker update or reload the user's app during installation.


## Pit-lane movement smoothness regression guard — 2026-11-06

- The garage exit and physical pit lane use the pit spline's own progress for every local collision/safety sweep. Never centre a pit-lane sweep on main-circuit `trackT`; during the initial garage exit that value is zero and the safety solver will snap the car toward the wrong end of the pit lane, causing visible jitter.
- Keep the pit spline continuously tangent through entry and merge using a smoothstep offset ramp, dense Catmull-Rom control points and high arc-length sampling. The same curve is the source for pit road mesh, markings, minimap, movement, and service-box placement.
- Preserve normal racing physics. The shared pit spline is for world geometry, local progress projection and boundary collision only; it must never steer or reposition the player. Collision sampling must follow `playerPitProgress` for both `playerGarageExit` and `playerPitting`.
- Bump the offline shell/game cache versions when changing racing runtime files so the new smoothness fix is available after an online visit and subsequent offline QA.


## Racing start and service-box stability

- Before a race grid countdown or after a physical pit service stop, clear all transient player motion state together: world velocity/speed, steering, throttle, brake pressure, lateral velocity/offset, heading, drift, longitudinal/lateral load and wheel lock. Reset held controls at the same transition. Do not let stale qualifying or braking inputs carry into the next start or pit exit.
- Initialize the 3D chase camera on the car's first rendered frame; do not ease it in from the world origin. Keep subsequent camera follow smoothing.

- Pit-box service detection is forgiving across the painted stop box (progress .45–.68) but still requires the player to physically brake to a near stop; the on-screen cue must say whether to follow the lane, brake/stop, or drive out.


## Integrated pit-world and quick-race standard — 2026-11-06

- Golden baseline for this iteration: `golden-baseline/vula-racing-2026-11-06` at `0d440cd3a63220ee99559abe13fffb45e61180cf`. Preserve this branch as the rollback point; do not rewrite or delete it.
- The pit lane is part of the visible, drivable circuit world, not a detached garage driveway. Its entry must peel from the outer edge of the main track, follow a parallel lane, and merge back onto the track at the exit. The shared `createRacingPitLane` curve is the single source for road mesh, markings, pit barriers, player projection and Kago AI navigation.
- Keep the main-track pit-wall openings aligned with the entry and exit connectors. Add an outer pit boundary and a service apron/garage beside the lane; never put a canopy, posts, service platform or wall across the drivable lane. The service box must be painted on the lane and physically reachable.
- Player and Kago use the same continuous pit-road geometry. The player manually steers into the lane, selects tyres from the compact proximity panel while rolling through the service bay, then manually drives out. No teleport, spline steering, auto-driving, artificial speed cap or velocity replacement. Kago may navigate the same route using its own AI and stop for service.
- Guidance is one clear action at a time: garage exit, track driving, upcoming corner, pit approach, pit entry, service stop, and pit exit. Avoid simultaneous instructions, contradictory arrows, unexplained jargon or directions referring to visual arrows that do not exist. Use short, child-readable prompts and contextual cues only when the player reaches the relevant situation.
- Keep the optional `Skip to Race` route on the main menu. It starts a normal two-lap race against Kago on the grid, bypassing garage/practice/qualifying, while preserving the mandatory pit-lane visit and tyre selection, AI, results and local-save behaviour. New Game and Continue retain their existing learning/save flows.
- When pit geometry, game flow or player-facing instructions change, bump both service-worker shell and game cache versions. Keep API and private customer data out of public caches.

## Pit exit and one-tap quick race corrections — 2026-11-06

- The pit branch begins at the outside edge, expands into the parallel pit corridor, and must return to the **main circuit centreline** at its exit. Never leave the merge endpoint one lane-width outside the circuit.
- Release pit-lane collision/projection ownership at the physical merge (once the player is close to the canonical circuit), rather than continuing to clamp the car against the finite pit spline after it rejoins.
- The player remains manually controlled throughout entry, tyre selection and exit. Do not require a stationary service stop; an unserviced pit run must not count as completed.
- **Skip to Race** is a disposable, immediate two-lap race against Kago. It must not create, require, or consume a save slot and must work when all save slots are occupied or local storage is unavailable. Normal New Game / Continue / Load / Save flows remain separate.
- Bump the service-worker shell and game cache versions together whenever these game files change.


## Race-only opponent presence — 2026-11-06

- Kago may be simulated as a hidden qualifying benchmark, but must have zero visible presence during practice, qualifying and the pre-race grid/countdown: no car, name tag, tyre marks, smoke/dust, sparks, map marker, tracker indicator or opponent-gap telemetry.
- Enable Kago's vehicle and race effects only once the actual race is running (race progress >= 2 and scored-race lap >= 3). Clear stale bot skid buffers and smoke particles while inactive so earlier race effects cannot linger.
- Keep qualifying-time calculation internal; do not expose the hidden benchmark as a visible opponent or tracker during practice/qualifying.
- Bump both service-worker cache versions whenever the race scene changes.


## Race toast discipline — 2026-11-07

- Remove repetitive instructional and celebratory coaching toasts during active driving. Keep the compact persistent signal chip for one contextual driving cue.
- Preserve meaningful milestone and reward feedback. In particular, a player victory over Kago must trigger a clear celebratory victory toast as well as the dedicated results screen. Do not suppress earned celebrations in the name of reducing noise.
- Toasts during the race should otherwise be concise, useful pit-crew or race-control updates about track conditions, pit entry/service/exit, Kago's meaningful race events, and lap validity. Do not toast routine control confirmations, NOS toggles/depletion, or ordinary contact.
- Prefix operational messages with `PIT CREW` or `RACE CONTROL` so the source is clear.
- Bump both service-worker shell and game cache versions whenever racing runtime files change.


## Open-circuit phase, map and pit access correction — 2026-11-07

- The player journey is three distinct experiences: **warm-up** (solo free driving to learn the environment), **qualifying** (solo timed performance), then **race** (Kago joins as a physical opponent). Do not treat warm-up or qualifying as a race grid, and do not show or simulate visible opponent presence in either phase. The Skip to Race action intentionally bypasses warm-up and qualifying and starts directly in the scored race; it must not invoke save/load prompts.
- The in-game circuit map shows the circuit, pit layout and **the player's car only**. Never draw an opponent car, marker, dot, legend entry or opponent telemetry on that map, even when Kago is active in the 3D race world.
- Keep pit crew/race-control toasts readable and event-driven in the lower-left notification lane; the in-game circuit map must remain visually above them and unobstructed. Preserve the earned victory celebration for beating Kago.
- The pit remains an open, drivable part of the world with connected entry and exit openings. Proximity to the actual pit route may hand boundary ownership to the pit spline so the player can approach from different angles, but the handoff must be local to the route. Never disable the main circuit boundary across a broad radius around the pit; outside the connected openings, the visible fence must remain a real collision boundary. Keep ordinary world-space steering through the pit lane and service apron.
- A boundary solver may protect the outer playable world, but must not create a forcefield between the circuit, pit apron, service area and exit. Verify the full path in both directions and from lateral approaches before claiming pit access is fixed.
- Bump both service-worker shell/game cache versions after runtime changes. Do not claim device gameplay QA unless actually run.


## Regression correction — menu opponent, race notifications and open pit apron (2026-11-07)

- Kago remains visible in the main-menu 3D preview as part of the established Vula Racing identity. In gameplay, his car, name tag and race effects stay hidden through warm-up, qualifying, grid and countdown, then appear when the actual scored race begins.
- Race toasts are session-scoped. Do not display or retain pit-crew/race-control toasts in the menu, garage-ready screen, grid, countdown or paused state. Clear stale notifications on reset and phase transitions. Preserve the earned victory toast and active pit/race event messages.
- Keep race toasts in the lower-left notification lane and the circuit map in the upper-right map lane. The map has higher stacking priority than toasts; no toast may cover it.
- Pit access must feel open, but it must not create ghost zones through the circuit fence. Use a local route-proximity handoff to the pit spline; do not use a broad apron-radius exemption. Keep the swept boundary solver active on both the main track and pit route. A player may leave without choosing tyres, but that does not satisfy the mandatory pit visit.
- Bump both offline shell and game cache versions for racing runtime changes. Report only build/deployment and gameplay checks actually completed.


## Fence and free-flow pit interaction correction — 2026-11-07

- The main circuit's single swept track-boundary solver remains authoritative. Do not disable it with a broad `pitApronOpen` radius: that creates ghost patches where the car can pass through the fence and reach the grass. Switch to the pit spline only when the player has committed to the actual pit route, and keep a finite safety envelope and swept substeps active there too.
- The rendered fence openings must align with the physical pit entry and exit. Everywhere else, the car must meet the track boundary, lose outward velocity and remain recoverable; do not add a second render-loop collision solver or change the approved handling model.
- Tyre selection is a GGL Space-style proximity interaction in the service bay, not a stationary service phase. Open the compact Soft / Medium / Hard panel as the player rolls through the service area; keep the race phase, momentum, steering, throttle and braking live. On selection, record the tyre choice, close the panel and show a short animated PIT CREW confirmation toast. The mandatory stop is satisfied only when the player physically exits after selecting tyres.
- Do not reintroduce a forced stop, modal pause, velocity reset, control lock, auto-drive or tyre-physics changes. Tyres remain presentation-only in this QA stage.


## Racing HUD layout rule — 2026-11-07

- The live circuit map owns the upper-right HUD corner and must stack above transient toasts (map z-index 5; toast z-index 4). Toasts belong in the lower-left lane, capped to leave the map's footprint clear on narrow phones.
- Keep driving guidance in its own top-centre signal chip. Keep transient event toasts visually secondary and brief; do not centre large toast banners across the gameplay viewport. Maintain separate spatial lanes for map, guidance and notifications rather than solving overlap with z-index alone.


## Final pre-QA hardening — 2026-11-07

- Preserve the established player-driving integration and single authoritative swept boundary solver. Collision and projection samples may be precomputed from immutable canonical curves, but sampled positions and tangents must remain identical to the 1,920-division arc-length samples.
- The physical pit spline has two valid exits: forward through the merge or reverse back through the entry connector. Release pit projection only at the connected circuit endpoint; never create a broad collision exemption or teleport the player.
- The mandatory tyre-selection pit visit must be completed within the two scored laps. If the player crosses the finish without servicing, record a DNF immediately rather than silently extending the race by another lap or awarding a misleading result.
- Keep the service interaction compact and outside the upper-right map and lower-left toast lanes. Player controls and world movement remain live while the tyre panel is open.
- Current service-worker caches are `vula-shell-v34` and `vula-game-v34`; bump both together for subsequent runtime changes.


## Pit-lane physical integration — corrective implementation rule (2026-11-07)

- The homepage is the only normal customer QA entry: open https://vulas-car-wash.vercel.app/, scroll to Vula Racing, then start New Game. Do not direct the product owner to /games, a nested route, or a unique Vercel deployment URL for normal gameplay QA.
- Preserve the approved player vehicle physics and world-space integration exactly. Do not steer, snap, teleport, auto-drive, pause, cap speed, replace velocity, or redirect the car onto a pit spline. The pit curve is geometry/projection context only.
- Pit commitment is local to the physical entry connector: require the scored race, the main-track entry window, and close physical proximity to the first connector segment. Never switch to pit projection merely because the player is near any arbitrary point on the complete pit spline.
- Once committed, track pit progress locally from the previous pit sample. Do not globally search the whole parallel spline each frame; a nearest-point jump can change the collision boundary under the car.
- The pit exit must be reached physically at the actual curve endpoint. Do not use a broad nearest-main-track search or a large join radius to release pit ownership. Forward exit merges at main-track T=.105; reverse exit returns through the entry at T=.91. Preserve the player's race progress on reverse exit.
- Keep one authoritative swept boundary solver. Main-track and pit-route ownership change only at the real connectors. Do not add a broad apron-radius collision exemption or a competing render-loop solver.
- The rolling tyre panel must not interrupt gameplay. A selected tyre only counts toward the mandatory pit visit after the player physically exits through a connected endpoint. Leaving without selecting tyres is allowed but does not satisfy the mandatory visit.
- Any change to racing runtime files must bump both service-worker caches together. Current cache version is v35 after the pit projection correction.
- Do not claim the pit is fixed, a race is smooth, or device QA passed until the homepage flow has been played through the pit entry, service interaction, both exit directions, and a full two-lap race on an actual device/browser.


## Open-world pit access — superseding correction (2026-11-07)

- This correction supersedes earlier instructions that restricted player pit entry to the narrow T=.895–.985 connector window or treated the pit as a separately fenced corridor.
- During the scored race, the player may enter the pit complex from any side at any point along its open apron. Detect physical proximity to the full pit-road spline; never snap, steer, teleport, pause, brake, cap speed, reset velocity or otherwise take control of the car during handoff.
- Keep the entire pit-side run of the main circuit visually open and remove the outer pit-apron wall. The pit complex is an open extension of the circuit, not a gated one-way lane.
- Match the pit collision envelope to the rendered 14.4-unit road width (7.15 units from centreline). Do not retain the narrow 3.5-unit corridor that behaves like an invisible wall.
- Keep local pit-spline progress tracking after initial physical handoff so the car cannot jump to a distant parallel segment. Keep the same world-space player physics and controls throughout.
- Tyre selection remains a rolling interaction. The mandatory pit visit is complete only after a tyre selection and a physical exit at either end of the pit road.
- The normal QA entry is https://vulas-car-wash.vercel.app/ → Vula Racing → New Game. Never direct QA to /games or a unique deployment URL.
- Both service-worker caches are now v36: vula-shell-v36 and vula-game-v36. Bump both together for every subsequent racing runtime change.
- Report code inspection, build status, deployment status and actual device gameplay QA separately. Never claim a full race or pit flow passed unless it was physically played through.


## Open pit collision and HUD layering — corrective override (2026-11-07)

- The pit spline must never act as an invisible wall or corridor boundary. Once the player is within 16 world units of the pit route during the scored race, hand off to the open pit complex without moving or changing the car.
- While on the pit route or in the garage exit, do not run the pit-spline swept boundary clamp. It was the source of the invisible force-field effect when the player tried to leave the lane/apron sideways. Keep world-space vehicle physics and player controls unchanged.
- Do not reintroduce a narrow corridor clamp, lateral steering correction, velocity cancellation, or route snapping to keep the player on the pit spline. The pit apron is open driving space.
- The circuit map must visibly render above all notifications (map z-index 50; toast z-index 3). Keep toast width constrained so a long message cannot occupy the map's screen area, including on narrow phones. The signal chip remains a separate top-left layer.
- Both service-worker caches are v37: vula-shell-v37 and vula-game-v37. Bump together after further runtime changes.
- QA only from https://vulas-car-wash.vercel.app/ → Vula Racing → New Game. Report build/deployment separately from actual physical gameplay QA.


## Racing HUD layout — structural stacking fix (2026-11-07)

- Render the live circuit map as a direct sibling of the 3D scene root inside .warmup-canvas-wrap. Do not nest the map inside the WebGL scene container; that can trap it in a stacking context beneath notifications.
- The viewport is an isolated stacking context. Scene root z-index 1, toast z-index 10, signal chip z-index 20, circuit map z-index 100.
- Reserve the map's full width plus a 24px desktop / 16px mobile gutter from both the signal chip and toast using the shared --map-width variable. A toast must never occupy the map's horizontal region.
- Keep the map readable with an opaque dark surface. Toasts are passive, pointer-events:none, two lines maximum, and disappear after 2.4 seconds. They must not cover driving controls or the map.
- Mobile map width is 104px; desktop map width is 132px. Re-test narrow portrait and landscape widths before claiming visual QA.
- Both service-worker caches are v38: vula-shell-v38 and vula-game-v38.

## Deployment verification discipline — 2026-11-07

- A GitHub push is not proof that Vercel received or built the commit. After every push, inspect Vercel deployment records for the exact commit SHA and confirm the deployment state before reporting a production update.
- If the exact commit has no deployment record, report it as not yet observed by Vercel; do not call it a failed build or attribute it to deployment limits without evidence.
- If Vercel access returns 403, stop retrying the same endpoint and report that deployment status could not be verified with the available permissions.
- Keep GitHub commit/check status, Vercel deployment/build status, and actual browser/device gameplay QA as three separate results.
- Normal gameplay QA starts at https://vulas-car-wash.vercel.app/ → Vula Racing → New Game.

## Pit forcefield removal — authoritative correction (2026-11-07)

- The open pit apron must not apply either the main-circuit swept boundary solver or the final nearest-centreline safety correction while `playerPitting` or `playerGarageExit` is active. Both corrections can push the car back toward the pit spline and create the invisible forcefield immediately after leaving the lane.
- Preserve ordinary world-space steering, throttle, braking, yaw and velocity while on the pit complex. Do not add a pit-lane corridor clamp, apron radius wall, lateral correction, velocity cancellation or route snapping.
- The circuit map is gameplay HUD only. Render it only when `preview === false`; never show it in the opening/menu 3D car preview.
- Both service-worker caches are now v39 and must be bumped together after further runtime changes.
- Verify open pit access by driving out of the lane sideways and returning from multiple apron sides. Do not claim physical QA unless actually tested in the live game.


## Pit apron collision must match the permanent open fence gap — 2026-11-07

- The outer pit-side fence is intentionally absent along the full pit branch (main-track T=.89 through .12). The physical collision solver must honour that same permanent opening on every scored lap, before and after the mandatory tyre visit.
- Do not use `playerPitDone`, `playerPitting`, or `playerGarageExit` as the sole switch for whether the outer pit apron is physically open. Those are race-flow/projection states; `playerPitDone` is a one-time service milestone and must never restore a wall.
- Determine the open apron collision region geometrically using BOTH proximity to the pit-road spline (within 16 world units) AND the negative/outside signed offset from the main circuit (less than -6.5). Proximity alone is too broad because the pit road runs close and parallel to the main track.
- In that geometrically defined open apron, skip both the main-track swept boundary correction and final nearest-centreline correction. On the racing surface, inner side, and all other fence sections, retain the authoritative collision solver.
- Keep projection/race progression separate from collision openness. Do not globally disable collisions, add a broad radius exemption, or alter vehicle physics.
- The visible outer rail omission in `racing-3d-scene.tsx` must remain aligned with the same pit-side T=.89–.12 opening.
- Both service-worker caches are v40: `vula-shell-v40` and `vula-game-v40`. Bump together after runtime changes.
- QA the pit-side opening on the first and subsequent scored laps, including after `playerPitDone` becomes true. Also confirm the opposite/inner fence remains solid. Do not claim physical QA unless actually played.
