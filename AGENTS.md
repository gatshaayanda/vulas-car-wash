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
- Kago's visible car scale and oriented collision footprint match the player (0.82 render scale and 1.52 × 0.89 half-extents). Three difficulty tiers: **Easy** preserves the enjoyable current competitive setup (19.0 world-units/second target); **Normal** steps up pace and racecraft (19.8); **Hard** is faster and more assertive (20.6), with stronger corner commitment and more tactical NOS. These are bot-only targets, not proof of lap pace: braking, throttle continuity, line choice, overtaking and NOS must be validated over full laps. Relative world-position sensing drives smoothly blended passing/defensive lines.
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


## Racing series, circuit construction and portable game identity (approved planning direction)

### Product vision
- Treat the racing experience as a self-contained, branded motorsport series embedded inside its host app. The series identity is configurable: Vula Racing is the current Vula's Car Wash identity, not a hard-coded identity that future host apps must inherit.
- The racing engine, track definitions, race rules, menus, season calendar, results and progression must be reusable. Host-app branding is a thin configuration layer, not a fork of the game.
- Before changing any racing identity, inspect the host app's actual brand tokens and instructions. Replace only the game-facing name, logo/mark, accent palette, copy, sponsor/team labels and optional series title. Never carry over Vula names, logos, colours, sponsor names or business copy into another host app by accident.
- Keep neutral internal identifiers for systems and data. Store branding in one clearly located configuration object (series name, short label, host brand, logo asset, accent colours, typography choices, sponsor/team naming, event naming and optional intro copy). UI components must read that configuration rather than contain Vula-specific strings.
- A future chat entering a different host repository must first inspect that repository's AGENTS.md, brand assets, typography, colour tokens and PWA conventions; then adapt the racing identity only. Do not change the host app's business workflows, install experience or unrelated screens.

### First circuit: reference-track standard
- Build one complete, memorable, fully drivable reference circuit before generating the remaining calendar. The first circuit establishes reusable geometry, scene dressing, barrier, pit-lane, timing, map, metadata and QA standards.
- The current prototype uses one closed Catmull-Rom centreline. Treat that centreline as navigation data, not as the complete track. A production circuit definition must explicitly describe: canonical centreline; road width and surface profile; inner/outer road edges; elevation/camber where supported; corner records and corner names; braking/turn-in/apex/exit references; start/finish and sector timing; grid slots; pit entry, pit lane, team boxes, pit exit and merge; run-off zones; barrier segments and types; marshal/signal points; scenery zones; track limits; and optional alternate layouts.
- Generate the visible road, shoulders, kerbs, run-off, walls/fences, pit lane, map and collision boundaries from the same canonical circuit data. Keep one authoritative track-boundary/collision solver. Visual geometry and collision geometry must agree; no decorative barrier may be mistaken for a drivable surface or vice versa.
- Road and barrier geometry must follow curves smoothly with stable joins, no gaps, z-fighting, floating sections or abrupt width changes. Use bounded, reusable buffers/instancing for repeated rails, posts, tyres, lights and grandstand details. Keep mobile GPU/memory budgets in mind.
- Build convincing trackside layers: asphalt with subtle material variation, painted edge lines, kerbs, runoff, drainage/grass/gravel where appropriate, tyre stacks or impact-absorbing barriers, guardrails/concrete walls, catch fencing, marshal posts, pit buildings, garages, grandstands, paddock, signage, start lights and trackside boards. Use visual variety without cluttering the racing sightline.
- Barrier placement is contextual: use stronger/closer protection where the circuit is constrained, and clear run-off where a mistake should be recoverable. A barrier collision during practice remains recoverable under the protected baseline rules. Do not claim FIA homologation or real-world safety compliance; this is an entertainment simulation informed by public circuit-design guidance.
- The pit complex must be a real connected route, not a painted decoration: pit entry branches off the racing surface, a speed-limited pit lane passes team garages/boxes, a designated stop box allows the car to stop for service, and a pit exit rejoins the circuit with a safe merge. Define a separate pit-path spline and pit speed zone, but integrate it with the same track coordinate and collision model. Prevent the player or AI from teleporting between track and pit lane.
- Add a service bay with visible crew animation/vehicle service feedback. Initially support a clear, reliable tyre-change action; expand to repairs and other service only when those effects are represented in the simulation. Pit stops must cost meaningful time and the player must be able to choose when to pit.
- The track map must display the complete circuit and meaningful pit branch, plus the actual positions of all cars. It must stay compact and readable on mobile and reflect the same canonical track data.

### Circuit design for enjoyable racing
- Design for racing rhythm rather than arbitrary complexity. The first reference circuit should include: a recognisable opening corner; a meaningful straight into a heavy-braking overtaking corner; a flowing linked-corner section; a technical low-speed turn that rewards patience on exit; a faster commitment corner; a second distinct passing opportunity; and a final sector that makes the lap memorable and sets up the next start/finish run.
- Avoid long stretches of low-decision driving, endless tight hairpins, blind unavoidable barrier traps and repetitive same-radius bends. Give corners different purposes and vary radius, direction, speed and visual character.
- Create overtaking through a fast approach followed by a braking decision, multiple viable lines, a corner exit that matters and enough road width for side-by-side racing. A passing zone is not merely a long straight: the approach, braking point, corner geometry and exit must all support a plausible contest.
- Make mistakes legible and recoverable: clear braking references, kerb cues, corner-number boards, marshal lights and visible track limits. Reward precision, but avoid punishing a new player with invisible boundaries or instant unrecoverable failure.
- Each corner should have a design record: name/number, type, target approach speed band, braking marker, turn-in, apex, exit, preferred line, alternate line, likely passing/defending use, run-off and barrier treatment, and Kago's precomputed corner knowledge.
- Test the circuit with player and Kago simultaneously. Measure lap pace, sector times, passing attempts/completions, contact, off-track events, corner speed retention and race-gap changes. Review both driver views; don't judge a track from an empty cinematic fly-through.

### Race weekend and pre-race setup menu
- Build a clear pre-session Race Control / garage menu that opens before the player enters the circuit. Keep the existing driving HUD and controls untouched while racing; do not overlay a large setup panel on the live road view.
- Organise choices into understandable groups with live consequences and concise explanations:
  - Tyres: soft, medium, hard; intermediate and wet when weather is active. Explain grip, warm-up and wear trade-offs. Tyre selection must affect grip, wear and stint life only when those mechanics are implemented and verified.
  - Fuel/load: race distance and starting fuel/load trade-off only if fuel mass/range is modelled. Otherwise omit or mark as future, never present a decorative setting as functional.
  - Aero: higher downforce versus lower drag only if the vehicle model supports corresponding cornering/straight-line effects.
  - Brake setup: brake bias and brake pressure/temperature only when the simulation supports measurable effects.
  - Suspension/ride height/gearing/differential: defer until the model has real, testable consequences; do not expose fake tuning sliders.
  - Strategy: starting tyre, planned pit window, optional second stint compound, and wet-weather response. Give the player a recommended strategy but always allow a reasoned alternative.
- Start with a small number of consequential choices rather than a wall of expert controls. Explain each trade-off in plain language and show the selected setup on the car/garage summary. Provide sensible defaults and a one-tap recommended setup.
- Setup must be saved with the race/session and shown in results. Kago should use a declared opponent setup/strategy and obey the same simulation rules; do not secretly weaken the opponent or grant hidden grip.
- A race weekend should eventually support warm-up/practice, qualifying, grid formation, race, pit strategy and results. Preserve the already-approved warm-up → qualifying → race → results direction. Add weekend structure in stages; do not replace the current Quick Break experience prematurely.

### Tyres, pit strategy and race conditions
- Design tyres as a readable strategic choice, not a hidden punishment. Soft = stronger short-run grip and quicker wear; medium = balanced; hard = less peak grip but longer life; intermediates/full wets become available only when damp/wet weather is implemented.
- Model wear in clear stages with visible feedback (pace drop, grip change, engineer warning and tyre condition), not random sudden failure. Tyre wear must be tied to distance, load, surface, temperature and driving style to the extent the simulation can support.
- Pit strategy should create a real decision: stay out on degrading tyres and defend track position, or lose time in the pit lane to gain fresher tyres. Make pit-lane transit, service time and rejoin position visible. Avoid mandatory pit stops unless the chosen event rules explicitly require them.
- Weather and track state should evolve in a legible way: dry, damp, wet; rain intensity and drying line only if physically represented. Seasonal presentation (foliage, lighting, sky, temperature, event dressing) may vary independently of handling; seasonal grip changes require explicit physics support and QA.
- Keep the first release deliberately bounded. Prefer a credible tyre-wear and pit-stop loop over superficial fuel, damage, weather or tuning systems that do nothing.

### Twelve-track calendar, variants and seasons
- The planned series has 12 distinct circuits. Do not create 12 unrelated hand-built implementations. Build a reusable circuit schema and editor-friendly track definition, then author each layout as data with its own centreline, boundaries, pit route, corner metadata, scenery theme and race characteristics.
- Every circuit must have a recognisable identity and driving challenge (for example: flowing high-speed venue, tight street circuit, technical stop-start venue, elevation circuit, desert night race, wet/coastal venue). Do not make variants that only recolour the same geometry.
- Derive controlled variants from a validated base layout: short/long configurations, alternate sector connection, reversed direction only where pit entry/exit, visibility and collision geometry are redesigned and validated. Each variant must have its own valid canonical path, timing sectors, boundaries and AI corner knowledge.
- Seasonal calendar changes should primarily affect event identity, sky/light, foliage, trackside dressing, temperature display, event branding and crowd presentation. Do not alter collision, track width or driving physics as a cosmetic seasonal side effect.
- Schedule events across a fictional year with a readable calendar, event countdown, results archive and returning venue identity. Weather can be an event condition; avoid making it random and unfair. Announce conditions before the race and let the player prepare.
- Store each event as data: event name, venue, round number, date/season, track/layout ID, weather preset, tyre allocation, race distance, qualifying format, rules, host-brand sponsor package and unlock state.

### Track authoring and QA workflow for every future chat
1. Read this AGENTS.md and the actual current track, scene, race-state, Race Control and persistence code before touching anything.
2. Confirm which host app/repository owns the game and read that host app's brand and PWA instructions.
3. Identify the canonical circuit data and all consumers (rendering, map, collision, AI navigation, timing, pit path, persistence). Never author a parallel track representation that drifts out of sync.
4. Make a track plan with a top-down layout and corner-by-corner purpose before changing geometry.
5. Implement the first reference circuit in isolated steps: road/edges → kerbs/run-off → barrier/collision alignment → pit branch/box/exit → scenery/signage → map/timing → race setup and strategy integrations.
6. Verify the track visually at player height and from the circuit map; test every join, barrier, pit entry/exit and track boundary at speed.
7. Test player and Kago together, including all current difficulty tiers, overtaking, side-by-side traffic, recoveries, pit entry, pit stop, pit exit and restart.
8. Run lint, TypeScript, build and identity checks where feasible. Verify PWA/offline launch and ensure all new local assets are precached with a service-worker cache version bump.
9. Record what is implemented versus planned. Never claim tyre wear, weather, pit service, setup effects, seasonal physics or AI circuit knowledge exists until tested in the game.
10. Only after the reference circuit passes QA, derive the remaining tracks and calendar from the same authoring schema.

### Scope and golden-baseline protections
- Planning and track work do not authorise unrelated changes to player physics, controls, camera, Kago tuning, Race Control save menus, Firebase contracts, career persistence, homepage business UX or PWA installation.
- Track geometry, pit-lane routing and barrier collision may be changed only as an isolated track feature. Keep the existing authoritative collision/boundary solver and extend it deliberately; never add a second solver.
- Preserve the live circuit map and the removal of the road centre guide line.
- Preserve offline play. Local race outcomes remain device-only unless server-verified through the existing trusted flow.
- Do not introduce paid services, external simulation dependencies, telemetry collection or online infrastructure without separate approval.
