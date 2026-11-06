# SaigonSafe upstream update

Upstream: bitwarden/clients `main`, commit `01a989e8f3b6bee449b1f03feef264019519b640` (2026-11-05 UTC).
Previous base: `93f0ccee5dc81810e2cdeca67c0df6bb78536b58`.
Local checkpoint: `871bab2c98`.

This merge incorporates 2,055 upstream commits, including the new vault presentation,
autofill safeguards, additional vault item types, Health screens, and Node 24 / Angular 21 tooling.
SaigonSafe artwork, toolbar status variants, autofill branding, browser identities,
autosave, inline password generation, notes display, and remembered-2FA logout cleanup
are retained. Autosave also honors upstream organization ownership and restricted-write checks.

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
   Chrome and Firefox sequentially because they share `apps/browser/build`.

Nothing is pushed or published by this update.

## Validation

- Node 24.22.2 / npm 11 dependency installation from the upstream lockfile.
- Chrome MV3 and Firefox builds, plus browser TypeScript and targeted ESLint checks.
- 608 browser tests; 135 shared vault tests; subscription-promotion service check;
  add/edit, logout and autofill snapshot regression checks.
- Artwork hashes for 121 assets, localized first-party text check, stable/beta
  wordmark and manifest tests, including browser-specific MV3 background handling.

The full web/desktop/CLI test suites were not run. Connected-server sync and
subscription-dependent cloud operations require integration testing with your server.
