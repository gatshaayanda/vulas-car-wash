# Vula's Car Wash

Customer-first PWA for Vula's Car Wash, built from the approved Iteration 13 foundation. The customer journey supports service selection, booking requests, mobile-service requests, walk-in queue entries, fleet enquiries, booking history, loyalty balances, and push-reminder registration. Staff tools remain under the protected admin route; gallery management is an admin capability, not a required customer-homepage section.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The public Firebase web configuration is included in `.env.example`. Keep `.env.local`, Firebase Admin service-account JSON, staff access words and reminder secrets out of Git.

## Environment configuration

- `NEXT_PUBLIC_BASE_URL`: local URL in development; set the actual deployed origin for production.
- `NEXT_PUBLIC_FIREBASE_*`: web app configuration for the dedicated `vulas-car-wash` Firebase project.
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`: Firebase Cloud Messaging Web Push certificate key; required to register browser push notifications.
- `FIREBASE_ADMIN_KEY`: server-only JSON for a service account from the Vula Firebase project. Required for staff sign-in and scheduled push reminders.
- `VULA_OPERATIONS_WORD`: private staff sign-in word. Configure as a server environment variable, never as a public variable.
- `VULA_REMINDER_CRON_SECRET`: bearer secret for the protected reminder endpoint. Use the same value in the server environment and GitHub Actions secret.
- `UPLOADTHING_TOKEN`: optional; not required for gallery photos, which use Firebase Storage.

## Customer routes and data

- `/`: service catalogue, booking request, mobile coverage review, walk-in queue, fleet enquiry, customer booking history, loyalty balance and reminder preferences. Keep the customer header focused on customer actions; do not add a Staff link or an unrequested Gallery section.
- `/iphone-install`: iOS Safari Add to Home Screen guidance.
- `/offline`: honest offline status and sync expectations.
- `/admin`: staff operations; sign-in is protected by the server-side access word and Firebase Admin custom token.

Firestore collections used by the active app: `admins`, `services`, `gallery`, `businessSettings`, `bookings`, `queueEntries`, `fleetRequests`, `loyaltyAccounts`, `reminderPreferences`, and `notificationTokens`. Vula Racing uses the server-only Admin SDK for `racingProfiles`, `racingResults`, and `racingSessions`; browser clients must not access those collections directly.

## Racing and staff operations

- `/games` is the 500 m traffic-and-obstacle warm-up with collision retry, steering, acceleration, braking and NOS. After opening it online once, the PWA caches its route and downloaded game code for offline play; local racing-model assets are precached where available and the game has a built-in visual fallback.
- `/games/career` retains the separate racing career mode.
- `/admin` is the protected staff workspace for bookings, walk-in queue, fleet enquiries, services, business settings, gallery, loyalty and server-stored racing activity.

## Online and offline behavior

Firestore uses persistent local cache for supported reads. If a customer submits while offline, the app stores the draft in this browser's local storage and retries with a stable request ID when a connection returns. A local draft is **not** visible to staff and is **not** a confirmed booking until the server accepts it. Keep the app/browser data until pending requests have synced. Racing career profiles and online race rewards use `/api/racing` with Firebase ID-token verification and server-owned progression; race results played offline remain device-only and are not later submitted as trusted rewards. The service worker uses versioned Vula-only shell/game caches and offers a Refresh action when an update is waiting; cache version strings must be bumped when shipping changed game assets.

Online requests use Firebase Anonymous Auth, so customers can begin without creating an account. Linking a guest session to Google preserves its Firebase UID for loyalty continuity on supported devices. A guest session that is never linked remains tied to that browser/device.

Staff confirm requests manually. The customer app does not claim a slot is confirmed, an online payment has been taken, or mobile coverage is approved merely because a request was submitted. Online payment processing is not connected to a payment gateway yet; customers can request payment instructions and staff can record verified payment status.

## Firebase setup

1. In Firebase Authentication, enable Anonymous and Google sign-in (and any other provider the business decides to support).
2. Publish the current `firestore.rules` in Firestore Rules.
3. Publish `storage.rules` in Firebase Storage Rules.
4. Deploy `firestore.indexes.json` so the scheduled booking reminder query is indexed.
5. In Firebase Cloud Messaging, create a Web Push certificate and configure `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
6. Configure `FIREBASE_ADMIN_KEY`, `VULA_OPERATIONS_WORD`, and `VULA_REMINDER_CRON_SECRET` in the production server environment.
7. Add GitHub Actions secrets `FIREBASE_SERVICE_ACCOUNT_JSON`, `VULA_REMINDER_CRON_SECRET`, and `VULA_PUBLIC_URL` if you want to use the scheduled reminder workflow and manual Firebase rules deployment workflow.

The manual workflow `.github/workflows/firebase-rules-deploy.yml` deploys Firestore rules, indexes and Storage rules to the dedicated Vula project. It requires a service-account secret and is intentionally not triggered automatically by every rules-file edit.

## Business settings that must be confirmed

Staff can update the business name, site/location label, address, opening hours, confirmed mobile coverage areas, slot capacity and booking notice from `/admin`. Keep placeholders until Vula confirms the facts. Capacity limits are checked in the staff confirmation UI for matching scheduled slots; requests remain unconfirmed until staff accept them.

No real payment provider, SMS/email provider, confirmed price list, opening hours, exact address or mobile coverage areas are assumed in code.

## Verification

```bash
npm run verify:identity
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions runs the type check, lint, identity/PWA verification and production build on pushes to `main`. Passing CI does not mean Firebase rules were published or a production deployment was verified.

### PWA install event ownership

The branded install card in `src/app/pwa-register.tsx` must be the single owner of the `beforeinstallprompt` event: capture the real event, prevent the automatic browser banner, and invoke that same event's `prompt()` directly from the user's Install-button click. Do not add a second early listener in `layout.tsx` or introduce a fake prompt. The install runtime is protected; change it only when explicitly authorized.

## QA checklist

- Confirm customer navigation has no Staff item and the homepage has no unrequested Gallery section.
- Test the booking time-selection modal against the Tripple S Spa pattern on mobile, including selecting a date/time and returning to the request form.
- Test customer booking, queue, fleet enquiry, service catalogue and customer booking history while online.
- Disconnect the device, submit a request, confirm it is labelled device-only/pending, reconnect, and verify it appears once in staff operations.
- Confirm staff can update booking, queue, fleet, service, gallery, business settings and loyalty balance.
- Confirm customers cannot read another customer's records or write staff-only collections.
- Test gallery image upload after Storage rules are published.
- Enable push reminders after the VAPID key and reminder secrets are configured; confirm only a *confirmed* upcoming booking triggers a reminder.
- On supported Chromium browsers, verify the Africhiko-approved branded install card appears only when `beforeinstallprompt` is available, its Install button invokes the captured native prompt directly from the user click, and its close control dismisses it. Preserve the event lifecycle and do not replace it with a permanent install CTA, imitation prompt or generic instructions.
- On iPhone/iPad Safari, verify the separate Share → Add to Home Screen guidance; do not expect Chromium's `beforeinstallprompt` event.
- Test refresh, offline shell, reconnect and installed-app behavior on actual devices.
