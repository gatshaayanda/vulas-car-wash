# Install card QA checkpoint

Reference inspected: `gatshaayanda/africhiko/src/app/pwa-register.tsx`.

Expected Chrome behavior for Vula's Car Wash:
- Render the branded, dismissible install card only after a genuine `beforeinstallprompt` event has been captured.
- Keep the browser-provided event and call its native `prompt()` from the customer's Install button click.
- Do not show manual Chrome menu instructions or a non-functional install button when no native event exists.
- Keep this change isolated from the racing game and its controls.

QA must still confirm the native prompt on a supported browser/device. GitHub quality checks are not a substitute for that browser test.

Preview retrigger commit: `chore: retrigger install card preview`.
