#!/usr/bin/env bash

####
# Compress the build directory into a zip file.
####

set -e
set -u
set -x
set -o pipefail

FILENAME=$1
BROWSER=$2

SCRIPT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_ROOT/../build/$BROWSER"
DIST_DIR="$SCRIPT_ROOT/../dist"

# Check if build directory exists
if [ -d "$BUILD_DIR" ]; then
  cd "$BUILD_DIR"
  
  # Create dist directory if it doesn't exist
  mkdir -p "$DIST_DIR"

  # Remove existing dist zip file
  DIST_PATH="$DIST_DIR/$FILENAME"
  rm -f "$DIST_PATH"

  # Compress build directory
  zip -r "$DIST_PATH" ./
  echo "Zipped $BUILD_DIR into $DIST_PATH"
else
  echo "ERROR: $BUILD_DIR not found, run the $BROWSER build first" >&2
  exit 1
fi
