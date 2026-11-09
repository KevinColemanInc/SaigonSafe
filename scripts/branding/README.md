# SaigonSafe browser artwork

`saigonsafe.cjs` is the source for the SaigonSafe S monogram, wordmarks,
toolbar states, instructional artwork, and light/dark illustrations.
It uses jade, ivory, and coral; local Firefox and Chrome builds use purple
and gold icons, including the locked, logged-out, and notification states.

Regenerate using Node and the repository's Playwright installation:

```sh
node scripts/branding/generate-browser-assets.cjs
node scripts/branding/generate-browser-assets.cjs --check
node --test scripts/branding/brand-assets.test.cjs
```

On macOS, generation uses installed Google Chrome. On other systems, install
the matching Playwright Chromium browser first. Generation renders SVG into
transparent PNG canvases at the exact original dimensions. SVG sources and
checksums are saved in `libs/assets/saigonsafe/`.

Both ordinary build commands select the purple icons:

```sh
npm run build:firefox --workspace=apps/browser
npm run build:chrome --workspace=apps/browser
```

`build:prod:firefox`, `build:prod:chrome`, and the production `dist:*` commands
keep the jade icons. Webpack swaps the packaged icon bytes, so manifest and
runtime status icon paths always agree. Source production images are never
overwritten by local builds. Firefox and Chrome write to separate directories:
`apps/browser/build/firefox` and `apps/browser/build/chrome`.

Both builds verify artwork checksums before running. Upstream export names
are compatibility aliases for the SaigonSafe artwork. Official third-party
store badges, security-key product photos, functional QR codes, and upstream
copyright/license notices retain their original meaning and attribution.
