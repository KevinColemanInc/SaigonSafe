# OSS Core Boundary

The maintained product surface in this repository is the OSS-owned core suite:

- browser
- web
- desktop
- CLI
- shared `libs/*` used by those applications

## Rules

- Maintained applications may depend on `libs/*` and external packages.
- Maintained applications must not depend on `bitwarden_license/*`.
- Shared contracts must live in OSS-owned libraries under `libs/*`.
- New build targets must reuse the maintained app entrypoints instead of creating a licensing-based fork.

## Enforcement

- `npm run lint:oss-boundary` fails on licensed path references and removed package imports.
- TypeScript path aliases do not expose `bitwarden_license/*`.
- Nx maintained app targets build from OSS-owned entrypoints only.
