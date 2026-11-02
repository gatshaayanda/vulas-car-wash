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
- The approved golden racing baseline is commit `83a46fbb907ab0ee61c272b99c4ed4fcf823ba8d` (drift physics presentation, stable chassis-aligned chase camera, rear-tyre smoke and skid marks). Preserve this commit in history as the permanent rollback/reference point; never rewrite or force-push it.
- Future racing work must build forward from this baseline. Do not replace its vehicle physics, steering, drift model, camera, controls, car presentation or drift effects unless the product owner explicitly authorizes that exact change.
- Track-only work must remain isolated to track geometry, barrier visuals and collision/track-boundary handling. Do not regress the golden driving feel while changing track behaviour.
- Barrier contacts during practice must remain recoverable. Never force a game-over, disable controls or respawn the player because of a normal track-edge collision.
- Use one authoritative track-boundary solver. Do not add competing render-loop collision corrections that can disagree with the driving simulation at curved segment joins.

## Racing opponents roadmap (approved direction)

### Landing-page 500 m warm-up — current local AI prototype
- The public landing-page game at `/games` is implemented by `src/app/games/racing-hub.tsx`; its styles are in `src/app/games/racing.css`. This is the customer-facing warm-up target when the product owner asks for a bot in the landing-page game.
- The landing-page race now presents one offline AI rival: Kago “The Attacker”, shown as a pink car on the same 500 m road. The opponent menu is visible above the race scene and lets the player select Easy / Normal / Hard before the countdown. Normal is the default.
- The 500 m warm-up compares player and bot distance and shows a head-to-head position/result. The bot currently follows a simple independent pace model; it is not yet a physics-driven opponent and does not yet steer around markers, choose lanes dynamically, overtake, collide, recover or use NOS.
- The landing-page game remains a local/offline prototype. Do not represent the bot as an online player or trusted leaderboard result.

### Separate career game
- `/games/career` is a separate experience implemented by `src/app/games/racing-career-hub.tsx`. Its Race Control save menus and its own pace-based Kago rival are independent of the landing-page warm-up.
- Do not redirect customers to Career to find landing-page racing features. When a request says landing page, implement and verify the change in `racing-hub.tsx` and its associated styles.
- Keep career save/profile/championship systems separate unless the product owner explicitly asks to connect them.

### Next implementation stages
1. **Track model:** define stable racing-line waypoints, corner zones, road boundaries and safe recovery for the landing-page circuit.
2. **Driving bot:** upgrade Kago from pace-only progress to steering/throttle/braking decisions, marker awareness, corner speed profiles, controlled mistakes and recovery.
3. **Shared driving rules:** reuse player movement and collision rules where architecture permits without changing the player's approved controls or driving feel.
4. **Race presentation:** add grid placement, synchronized countdown, opponent position changes, finish ordering and clear result presentation.
5. **Local QA:** test Easy/Normal/Hard, bot wins and player wins, marker interactions, pause/resume, restart, mobile controls, offline play and service-worker cached launch.
6. **Online multiplayer foundation:** only after local races are reliable, add a separately hosted persistent multiplayer service (Colyseus remains a candidate). Do not use ordinary Vercel serverless request handlers as persistent real-time sockets.
7. **Private rooms and matchmaking:** room codes first, then automatic matchmaking, reconnect handling and player presence.
8. **Authoritative validation:** server owns online race sessions/results; validate player inputs and track progress rather than trusting client-submitted positions or rewards.
9. **Hybrid grids and competition:** allow real players to race alongside AI fillers, then add verified leaderboards, championships and seasonal standings.

### Non-negotiable protections
- Work only in `gatshaayanda/vulas-car-wash` for Vula Racing tasks unless the product owner explicitly names another repository.
- Preserve the approved golden vehicle, steering, drift, camera, controls, collisions, effects, PWA install/offline behavior and existing Race Control save menus. Do not change the career experience while implementing a landing-page request.
- Never claim a bot is physics-driven, online, server-authoritative or capable of overtaking until those exact capabilities are implemented and tested.
- Keep offline results device-only. Only server-verified results may enter shared leaderboards or award verified online credits.
- Do not add a multiplayer service, credentials, deployment or recurring cost without a separate implementation plan and explicit approval.
