# SaigonSafe branding

Use the SaigonSafe logo and artwork for all first-party app identity, including
browser toolbar icons, status variants, autofill, onboarding, and wordmarks.
Do not reintroduce the Bitwarden shield or wordmark as SaigonSafe branding.
Preserve third-party trademarks and upstream copyright/license notices.

Browser artwork is generated from `scripts/branding/saigonsafe.cjs` by
`node scripts/branding/generate-browser-assets.cjs`. Run its `--check` mode after
changing branding; Firefox and Chrome builds also run this check automatically.

# SaigonSafe local security

Keep subscription promotions and cross-product ads out of the browser extension.
TOTP generation, copying and autofill, local security reports, and Health details
are free local capabilities. Preserve vault permissions, reprompts, authentication,
autofill safeguards, and existing server-backed features. Keep server billing and
subscription state accurate; local feature access must not fabricate an entitlement.

See `docs/saigonsafe-upstream-update.md` for the upstream revision, preserved
customizations, local-feature scope, and update checks.
