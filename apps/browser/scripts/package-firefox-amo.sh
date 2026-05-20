#!/usr/bin/env bash

####
# Build the Firefox extension package for AMO and assemble a matching source package.
# Prints the uncompressed and compressed output locations for both artifacts.
####

set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BROWSER_ROOT="$(cd "$SCRIPT_ROOT/.." && pwd)"
REPO_ROOT="$(cd "$BROWSER_ROOT/../.." && pwd)"

BROWSER_VERSION="$(node -p "require('$BROWSER_ROOT/package.json').version")"
BUILD_DIR="$BROWSER_ROOT/build"
DIST_DIR="$BROWSER_ROOT/dist"
EXTENSION_ZIP="$DIST_DIR/dist-firefox.zip"
SOURCE_DIR="$DIST_DIR/firefox-amo-source-$BROWSER_VERSION"
SOURCE_ZIP="$DIST_DIR/firefox-amo-source-$BROWSER_VERSION.zip"

mkdir -p "$DIST_DIR"

echo "Building Firefox extension for AMO..."
(cd "$BROWSER_ROOT" && npm run build:prod:firefox)

echo "Compressing Firefox extension..."
(cd "$BROWSER_ROOT" && ./scripts/compress.sh "$(basename "$EXTENSION_ZIP")")

echo "Preparing AMO source package..."
rm -rf "$SOURCE_DIR" "$SOURCE_ZIP"
mkdir -p "$SOURCE_DIR"
mkdir -p "$SOURCE_DIR/apps/browser" "$SOURCE_DIR/libs"

rsync -a \
  --exclude node_modules \
  --exclude build \
  --exclude dist \
  --exclude .git \
  "$BROWSER_ROOT/" \
  "$SOURCE_DIR/apps/browser/"

rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "$REPO_ROOT/libs/" \
  "$SOURCE_DIR/libs/"

cp "$REPO_ROOT/package.json" "$SOURCE_DIR/"
cp "$REPO_ROOT/package-lock.json" "$SOURCE_DIR/"
cp "$REPO_ROOT/tsconfig.base.json" "$SOURCE_DIR/"
cp "$REPO_ROOT/babel.config.json" "$SOURCE_DIR/"
cp "$REPO_ROOT/.nvmrc" "$SOURCE_DIR/"

cat > "$SOURCE_DIR/BUILD.md" <<EOF
# Firefox AMO Source Build Instructions

## Operating system / build environment
Tested with:
- Node.js 22.12.0 or newer
- npm 10.x

This repository pins Node with \`.nvmrc\` (\`v22\`) and declares:
- node: \`>=22.12.0\`
- npm: \`~10\`

## Install requirements
1. Install Node.js 22.12.0 or newer
2. Install npm 10.x
3. From the repository root, install dependencies:

\`\`\`bash
npm ci
\`\`\`

## Build script
The Firefox build scripts are defined in:
- \`apps/browser/package.json\`

## Build the Firefox extension
From the repository root:

\`\`\`bash
npm --prefix apps/browser run build:prod:firefox
\`\`\`

## Build the Firefox upload archive
From the repository root:

\`\`\`bash
npm --prefix apps/browser run dist:firefox
\`\`\`

## Expected output
The compiled extension directory is created at:

\`\`\`text
apps/browser/build/
\`\`\`

The Firefox upload archive is created at:

\`\`\`text
apps/browser/dist/dist-firefox.zip
\`\`\`

## Notes
- The Firefox manifest source is in \`apps/browser/src/manifest.v3.json\`
- The project uses webpack for bundling
- Source files are included in this package in untranspiled form
EOF

echo "Compressing AMO source package..."
(
  cd "$DIST_DIR"
  zip -rq "$(basename "$SOURCE_ZIP")" "$(basename "$SOURCE_DIR")"
)

echo
echo "Firefox AMO artifacts:"
echo "  Extension directory: $BUILD_DIR"
echo "  Extension zip:       $EXTENSION_ZIP"
echo "  Source directory:    $SOURCE_DIR"
echo "  Source zip:          $SOURCE_ZIP"
