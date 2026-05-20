/* eslint-disable no-console */

/// Ensure that the OSS workspace does not depend on removed commercial SDK packages.

import fs from "fs";
import path from "path";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
);

const sdkInternal = packageJson.dependencies["@bitwarden/sdk-internal"];

if (!sdkInternal) {
  console.error("Missing required dependency: @bitwarden/sdk-internal.");
  process.exit(1);
}

if (packageJson.dependencies["@bitwarden/commercial-sdk-internal"]) {
  console.error("Unexpected commercial dependency: @bitwarden/commercial-sdk-internal.");
  process.exit(1);
}

console.log(`OSS SDK dependency is configured: ${sdkInternal}`);
