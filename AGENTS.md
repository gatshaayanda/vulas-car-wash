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
