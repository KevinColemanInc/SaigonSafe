# SaigonSafe features and differences from Bitwarden

Updated: November 9, 2026.

This inventory compares the current SaigonSafe working tree with its recorded
Bitwarden upstream base, commit `01a989e8f3b6bee449b1f03feef264019519b640`
(November 5, 2026). It includes local, uncommitted changes and describes implemented
behavior, rather than planned features or a comparison with later Bitwarden releases.
Most differences concern the browser extension; changes in shared libraries are
identified where relevant.

## Free authenticator codes

| Feature | What it does |
| --- | --- |
| Free TOTP generation and countdown | Generates and displays rotating authenticator codes from a saved login's authenticator key, including the expiry countdown, for signed-in free accounts. |
| Free TOTP copying | Enables copying verification codes from vault items without Premium, while retaining account, item-access, reprompt, and clipboard safeguards. |
| Free TOTP context-menu actions | Makes verification-code copying available through the browser's right-click menu for signed-in free accounts. |
| Free TOTP autofill | Fills verification-code fields without a Premium entitlement, including inline suggestions for eligible one-time-code inputs. Existing unlock, URI, frame, and navigation checks still apply. |
| Subscription-free authenticator workflow | Supports adding an authenticator key, capturing its QR code on supported browser surfaces, generating codes, copying, and autofilling as a free workflow. QR capture itself is inherited from upstream. |

Sources: [autofill service](apps/browser/src/autofill/services/autofill.service.ts),
[inline field recognition](apps/browser/src/autofill/services/inline-menu-field-qualification.service.ts),
[context menus](apps/browser/src/autofill/browser/main-context-menu-handler.ts),
[shared code display](libs/vault/src/cipher-view/login-credentials/login-credentials-view.component.ts),
[shared copy service](libs/vault/src/services/copy-cipher-field.service.ts).

## Free security analysis

| Feature | What it does |
| --- | --- |
| Local security page | Adds **Settings → Local security**, a free report showing the number of checked logins and links to items needing attention. |
| Local weak-password detection | Flags checked logins whose password-strength score is below 3. |
| Local reused-password detection | Finds passwords shared by more than one checked login. |
| Local insecure-website detection | Flags checked logins with a saved `http://` website address. |
| Offline-only report analysis | Computes Local security findings on the device with breach checking disabled. Passwords and report results are never uploaded or persisted by this report. |
| Permission-aware, account-aware reports | Excludes deleted, undecryptable, password-unreadable, and master-password-reprompt items. Clears previous findings when the account, unlock state, or vault contents change. Results contain item identifiers, names, and risk flags, without passwords. |
| Free Health details | Removes the Premium lock from Health's exposed, weak, and reused password detail pages for signed-in users who otherwise qualify for Health. The existing Health feature flag and account/organization eligibility checks remain. |

**Local security and Health are different reports.** Health retains upstream breach
checking and is not guaranteed to work entirely offline. Local security is the
offline-only option and covers only the eligible logins described above.

Sources: [Local security report](apps/browser/src/tools/popup/local-security/local-security-report.service.ts),
[report interface](apps/browser/src/tools/popup/local-security/local-security.component.html),
[Health access rules](apps/browser/src/dirt/health/popup/services/health-access.service.ts),
[Health overview](apps/browser/src/dirt/health/popup/health.component.ts).

## Vault editing and password generation

| Feature | What it does |
| --- | --- |
| Automatic saving of existing items | Saves valid edits after three seconds without further changes. Applies to normal editing of existing browser vault items; new-item creation, passkey sessions, and single-action popouts retain manual saving. |
| Visible save status | Shows pending, saving, saved, or failed status in the editor, with accessible live announcements. |
| Save before closing the editor | The editor's Back/Close action attempts to save pending changes immediately and stays in the editor if validation or saving prevents completion. This does not guarantee a save when the browser or extension is forcibly closed. |
| Autosave retry and overlapping-edit handling | Retains edits after failures, allows retry with Save or another edit, serializes writes, and preserves newer input entered while a save is in progress. Existing ownership rules and restricted-write protections still apply. |
| Generate a password in place | Adds a refresh button beside the password field to generate and insert a password without opening the generator dialog. Uses the account's saved generator settings and policies and attempts to record the result in generator history. |
| Reliable notes display | Binds the notes textarea to the current item's value so switching items displays the correct notes. This is a display fix to the inherited notes feature. |

Sources: [browser editor](apps/browser/src/vault/popup/components/vault/add-edit/add-edit.component.ts),
[shared form and autosave](libs/vault/src/cipher-form/components/cipher-form.component.ts),
[save service](libs/vault/src/cipher-form/services/default-cipher-form.service.ts),
[inline generator](apps/browser/src/vault/popup/services/browser-cipher-form-generation.service.ts),
[password-field button](libs/vault/src/cipher-form/components/login-details-section/login-details-section.component.html),
[notes display](libs/vault/src/cipher-view/additional-options/additional-options.component.html).

## Opening the vault, startup, and logout

| Feature | What it does |
| --- | --- |
| Full-height vault from the toolbar | Toolbar clicks open the vault in Chrome/Edge's side panel or Firefox's sidebar, replacing the default small toolbar popup. Browsers without a supported side pane open or focus a full vault tab. |
| Persistent pane behavior | Keeps the vault side panel available after autofill triage and clears temporary popup routes after special flows so subsequent toolbar clicks continue to open the full pane. |
| Immediate cached configuration | Browser foreground and background services use cached server settings, or conservative defaults, immediately while refreshing in the background. An unavailable server does not block startup waiting for configuration. |
| Cached vault before first sync completes | Allows cached items to render before the initial sync finishes, subject to existing encryption and unlock checks. Accounts without cached items still wait for the first sync before showing an empty vault. |
| Nonblocking initial sync | Runs the initial full sync independently of startup completion and notification-listener setup, reducing startup delays on slow or unavailable connections. |
| Configuration refresh on open and focus | Requests fresh server settings asynchronously when the extension pane opens or regains focus, even when the cache is still fresh. Concurrent requests within a configuration service share a refresh for the same account/server; failures retain cached settings. |
| Longer configuration cache interval | Changes the shared default configuration retrieval interval from one hour to 48 hours and removes the browser development build's five-second override. Explicit pane-open/focus refreshes still occur. |
| Forget remembered two-factor authentication on logout | Clears the logged-out account's remembered two-factor token, identified by email, so the remembered token cannot skip two-factor verification on the next login. |

Sources: [toolbar behavior](apps/browser/src/background/toolbar.background.ts),
[popup handling](apps/browser/src/platform/browser/browser-popup-utils.ts),
[background startup and logout](apps/browser/src/background/main.background.ts),
[cached vault loading](apps/browser/src/vault/popup/services/vault-popup-items.service.ts),
[configuration service](libs/common/src/platform/services/config/default-config.service.ts),
[pane refresh](apps/browser/src/popup/app.component.ts).

## Subscription and promotion experience

| Feature | What it does |
| --- | --- |
| Subscription banners removed | Removes the vault's Premium spotlight and Settings' upgrade banner; the shared Premium upsell service no longer recommends an upgrade. |
| Upgrade chips and Health purchase button removed | Makes the shared Premium badge render no promotional chip or icon and removes Health's upgrade-to-view-passwords button. Server-gated features retain their actual access checks. |
| Cross-product settings promotions removed | Replaces the download-app and “More from Bitwarden” promotional entries in Settings with Local security. |
| Local tools replace purchase prompts | Redirects legacy Premium and cross-product promotion routes, plus browser Premium upgrade prompts, to Local security. That page explains which capabilities still require connected-server support. |

These changes do not fabricate a Premium entitlement or alter server billing state.
Attachments, Send/file sharing, archive, emergency access, and account recovery retain
their existing connected-server requirements and permissions.

Sources: [Settings interface](apps/browser/src/tools/popup/settings/settings-v2.component.html),
[vault interface](apps/browser/src/vault/popup/components/vault/vault.component.html),
[shared upsell service](libs/angular/src/vault/services/premium-upsell.service.ts),
[shared badge](libs/angular/src/billing/components/premium-badge/premium-badge.component.ts),
[browser upgrade handling](apps/browser/src/billing/popup/services/browser-premium-upgrade-prompt.service.ts),
[routes](apps/browser/src/popup/app-routing.module.ts).

## SaigonSafe identity and artwork

| Feature | What it does |
| --- | --- |
| SaigonSafe browser identity | Uses SaigonSafe names in extension manifests, toolbar titles, context menus, browser page titles, About, onboarding, and localized first-party browser copy, including beta identity. |
| Custom logo, wordmark, and illustrations | Replaces first-party Bitwarden shield/wordmark artwork with SaigonSafe's S monogram, wordmarks, autofill marks, onboarding art, and light/dark illustrations. Shared logo exports also use SaigonSafe artwork. |
| Branded toolbar status variants | Supplies SaigonSafe icons for normal, locked, logged-out, and notification states, including Safari assets. |
| Distinct local-build icons | Uses purple-and-gold icons for local Chrome/Firefox builds and jade production icons, making local builds recognizable without overwriting production artwork. |

Third-party trademarks and upstream copyright/license notices remain attributed.
Rebranded text does not establish separate SaigonSafe cloud services, mobile apps,
or support offerings.

Sources: [artwork source](scripts/branding/saigonsafe.cjs),
[artwork documentation](scripts/branding/README.md),
[browser text rebranding](scripts/branding/rebrand-browser-messages.cjs),
[icon selection](apps/browser/webpack/brand-icons.cjs),
[shared SVG assets](libs/assets/src/svg/svgs).

## Build and maintenance differences

| Feature | What it does |
| --- | --- |
| Reproducible branding generation and checks | Generates browser artwork from one source, records SVG sources and asset checksums, and provides artwork/text `--check` commands. Standard Chrome and Firefox build commands automatically check artwork. |
| Separate browser build outputs and caches | Writes standard builds to `apps/browser/build/<browser>` and separates webpack caches by browser, manifest version, and configuration, preventing Chrome and Firefox builds from overwriting each other. Packaging, development launch paths, Safari resources, and end-to-end paths follow the matching browser output. |
| Dedicated unpacked build commands | Adds `build:unpacked:chrome` and `build:unpacked:firefox`, writing to separate `apps/browser/dist/chrome` and `apps/browser/dist/firefox` directories. The Firefox unpacked command explicitly builds Manifest V3. |
| Firefox MV3 manifest compatibility | Limits `use_dynamic_url` to Chrome, including entries nested in manifest arrays, so generated Firefox manifests omit the Chrome-specific setting. |
| Build/package Makefile shortcuts | Adds `make build-firefox`, `make build-chrome`, `make deploy-firefox`, and `make deploy-chrome`. The deploy targets build and package local ZIP files; they do not publish to a store. |
| Documented customization and update rules | Records the upstream base, preserved customizations, local-feature boundaries, build locations, and update checks to guide future upstream merges. |

Sources: [build scripts](apps/browser/package.json),
[webpack configuration](apps/browser/webpack.base.js),
[manifest transformation](apps/browser/webpack/manifest.js),
[Makefile](Makefile),
[upstream update notes](docs/saigonsafe-upstream-update.md),
[repository instructions](AGENTS.md).

## Inherited capabilities

Core vault encryption, synchronization, ordinary credential autofill, passkeys,
folders, vault item types, Webmapper, manual password generation, import/export,
and supported server-backed features come from Bitwarden. They are not separate
SaigonSafe additions unless a specific changed behavior is listed above. This
inventory does not imply that every browser customization is implemented in the
web, desktop, CLI, or mobile clients.
