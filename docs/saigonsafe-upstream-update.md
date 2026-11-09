# SaigonSafe upstream update

Upstream: bitwarden/clients `main`, commit `01a989e8f3b6bee449b1f03feef264019519b640` (2026-11-05 UTC).
Previous base: `93f0ccee5dc81810e2cdeca67c0df6bb78536b58`.
Local checkpoint: `871bab2c98`.

This merge incorporates 2,055 upstream commits, including the new vault presentation,
autofill safeguards, additional vault item types, Health screens, and Node 24 / Angular 21 tooling.
SaigonSafe artwork, toolbar status variants, autofill branding, browser identities,
autosave, inline password generation, notes display, and remembered-2FA logout cleanup
are retained. Autosave also honors upstream organization ownership and restricted-write checks.

## Opening and offline startup

- Toolbar clicks open the full-height Chrome/Edge side panel or Firefox sidebar.
  Browsers without a side pane open or focus a full vault tab. Temporary popup routes
  clear themselves afterward so they do not restore the small toolbar popup.
- Browser foreground and background services use cached server configuration (or
  conservative defaults when none exists) immediately while refreshing it in the
  background. Other clients retain their existing configuration-loading behavior.
- The default configuration retrieval interval is 48 hours; the browser development
  build no longer overrides it to five seconds. Opening or refocusing the pane requests
  an asynchronous refresh even for a fresh cache. Concurrent refreshes for the same
  account/server share one request, and failures keep the cached settings available.
- Cached vault items can render before the first sync completes. Accounts with no
  cached items still wait for their first sync before displaying an empty vault.
  Vault contents continue to use the existing encrypted storage and unlock checks.
- Initial sync runs independently of startup completion and notification listeners.
- Legacy promotion redirects rely on the authentication guard on `local-security`.
  Activation guards on those redirect routes are invalid in Angular and prevent the
  entire pane from bootstrapping.

## Free local features

- TOTP generation, countdown, copy, QR capture, context-menu actions and autofill work for
  signed-in free accounts. Account access, reprompts, URI matching, frame/navigation checks,
  and clipboard preferences still apply. No billing state is fabricated or written.
- Settings → Local security computes weak-password, reused-password, and HTTP-site findings
  on the device. Breach checking is explicitly disabled for this report. Results contain
  item identifiers and names, never passwords, and are not uploaded or persisted.
  Unreadable, deleted, undecryptable and master-password-reprompt items are excluded.
  Account switches and vault revisions clear old findings before new analysis.
- Upstream Health detail pages are also free for signed-in users when the Health feature
  is enabled. Its existing breach-check behavior is retained; use Local security for
  offline-only analysis.

## Promotions and server features

The vault/settings subscription banners, upgrade chips, Health upgrade button, and
cross-product settings promotions are removed. Legacy Premium and promotion routes lead
to Local security. Server-gated actions explain their requirements there rather than
opening purchase dialogs. Existing server-backed attachments, Send, archive, emergency
access and recovery are retained; their availability still depends on the connected
server. SaigonSafe does not claim to provide cloud storage or server capabilities locally.

## Updating again

1. Checkpoint local changes and fetch `https://github.com/bitwarden/clients.git` main.
2. Merge while retaining upstream behavior and SaigonSafe's local additions.
3. Run `node scripts/branding/rebrand-browser-messages.cjs` for new first-party copy.
   Preserve actual third-party product names and upstream notices.
4. Run `node scripts/branding/generate-browser-assets.cjs` if artwork sources change.
5. Verify text/artwork using both scripts' `--check` modes. Run affected tests and build
   Chrome and Firefox. Their outputs are isolated in `apps/browser/build/chrome`
   and `apps/browser/build/firefox`.

Nothing is pushed or published by this update.

## Loading local browser builds

Standard builds write to `apps/browser/build/<browser>`:

- `make build-firefox` (or `npm run build:firefox --workspace @bitwarden/browser`)
  writes to `apps/browser/build/firefox`.
- `make build-chrome` (or `npm run build:chrome --workspace @bitwarden/browser`)
  writes to `apps/browser/build/chrome`.

Development, watch, production, and commercial builds use the same browser-specific
layout. Packaging reads the matching browser directory and still writes zip files
to `apps/browser/dist`. Nx builds retain their explicit `dist/apps/browser/*` paths.

Load the matching browser directory rather than the old shared `apps/browser/build`
folder. Loading a Chrome build in Firefox produces the
`background.service_worker is currently disabled` error; the browser-specific bundles
also differ, so do not edit a generated manifest to switch browsers.

The existing unpacked commands retain their explicit output paths:

- `npm run build:unpacked:firefox --workspace @bitwarden/browser` writes to
  `apps/browser/dist/firefox`. Load its `manifest.json` through Firefox's
  `about:debugging` → This Firefox → Load Temporary Add-on. This is an MV3 build
  with `background.scripts: ["background.js"]`.
- `npm run build:unpacked:chrome --workspace @bitwarden/browser` writes to
  `apps/browser/dist/chrome`. Load that folder through Chrome's Load unpacked action.

These commands leave `apps/browser/build` and the other browser's unpacked build intact.

## Validation

- Node 24.22.2 / npm 11 dependency installation from the upstream lockfile.
- Chrome MV3 and Firefox builds, plus browser TypeScript and targeted ESLint checks.
- 608 browser tests; 135 shared vault tests; subscription-promotion service check;
  add/edit, logout and autofill snapshot regression checks.
- Artwork hashes for 121 assets, localized first-party text check, stable/beta
  wordmark and manifest tests, including browser-specific MV3 background handling.

The full web/desktop/CLI test suites were not run. Connected-server sync and
subscription-dependent cloud operations require integration testing with your server.
