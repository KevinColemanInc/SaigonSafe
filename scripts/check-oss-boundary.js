const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEFAULT_ROOT = path.join(__dirname, "..");
const SEARCH_TARGETS = [
  ".github",
  ".storybook",
  ".claude",
  "apps",
  "libs",
  "scripts",
  "angular.json",
  "clients.code-workspace",
  "jest.config.js",
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.eslint.json",
];

const LICENSED_PATH_PATTERNS = [
  "bitwarden_license/bit-browser",
  "bitwarden_license/bit-cli",
  "bitwarden_license/bit-web",
  "bitwarden_license/bit-common",
];

const RESTRICTED_IMPORT_PATTERNS = ["@bitwarden/bit-common/", "@bitwarden/commercial-sdk-internal"];

const RG_EXCLUSIONS = [
  "--glob",
  "!scripts/check-oss-boundary.js",
  "--glob",
  "!scripts/**/*.spec.js",
  "--glob",
  "!scripts/sdk-internal-versions.ts",
  "--glob",
  "!eslint.config.mjs",
];

function buildRgArgs(patterns, globArgs = []) {
  const patternArgs = patterns.flatMap((pattern) => ["-e", pattern]);

  return ["-n", "--no-heading", ...globArgs, ...patternArgs, ...SEARCH_TARGETS];
}

function runRg(rootDir, patterns, globArgs, label, execFileSyncImpl) {
  try {
    return execFileSyncImpl("rg", buildRgArgs(patterns, globArgs), {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (error.status === 1) {
      return "";
    }

    throw new Error(`Failed to run boundary check for ${label}:\n${error.stderr || error.message}`);
  }
}

function runBoundaryCheck(options = {}) {
  const {
    rootDir = DEFAULT_ROOT,
    execFileSyncImpl = execFileSync,
    existsSyncImpl = fs.existsSync,
    readFileSyncImpl = fs.readFileSync,
  } = options;

  const errors = [];
  const packageJsonPath = path.join(rootDir, "package.json");
  const licensedRootPath = path.join(rootDir, "bitwarden_license");
  const packageJson = JSON.parse(readFileSyncImpl(packageJsonPath, "utf8"));

  if (packageJson.dependencies?.["@bitwarden/commercial-sdk-internal"]) {
    errors.push("package.json still depends on @bitwarden/commercial-sdk-internal.");
  }

  if (existsSyncImpl(licensedRootPath)) {
    errors.push(
      "Commercial source tree still exists at bitwarden_license/. Remove it to keep the repo OSS-only.",
    );
  }

  try {
    const licensedPathMatches = runRg(
      rootDir,
      LICENSED_PATH_PATTERNS,
      RG_EXCLUSIONS,
      "licensed path references",
      execFileSyncImpl,
    );

    if (licensedPathMatches) {
      errors.push(`Licensed path references remain:\n${licensedPathMatches}`);
    }

    const importMatches = runRg(
      rootDir,
      RESTRICTED_IMPORT_PATTERNS,
      RG_EXCLUSIONS,
      "restricted imports",
      execFileSyncImpl,
    );

    if (importMatches) {
      errors.push(`Restricted import references remain:\n${importMatches}`);
    }
  } catch (error) {
    errors.push(error.message);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function main() {
  const result = runBoundaryCheck();

  if (!result.ok) {
    console.error(result.errors.join("\n\n"));
    process.exit(1);
  }

  console.log("OSS boundary check passed.");
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRgArgs,
  DEFAULT_ROOT,
  LICENSED_PATH_PATTERNS,
  RESTRICTED_IMPORT_PATTERNS,
  RG_EXCLUSIONS,
  SEARCH_TARGETS,
  runBoundaryCheck,
};
