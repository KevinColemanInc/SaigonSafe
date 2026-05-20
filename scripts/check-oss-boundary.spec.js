const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  LICENSED_PATH_PATTERNS,
  RESTRICTED_IMPORT_PATTERNS,
  SEARCH_TARGETS,
  buildRgArgs,
  runBoundaryCheck,
} = require("./check-oss-boundary");

function createRepoFixture(extraFiles = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oss-boundary-"));

  const baseFiles = {
    "package.json": JSON.stringify(
      {
        name: "fixture",
        dependencies: {
          "@bitwarden/sdk-internal": "0.0.0-test",
        },
      },
      null,
      2,
    ),
    "apps/.gitkeep": "",
    "libs/.gitkeep": "",
    "scripts/.gitkeep": "",
    "angular.json": "{}",
    "clients.code-workspace": "{}",
    "jest.config.js": "module.exports = {};",
    "tsconfig.json": "{}",
    "tsconfig.base.json": "{}",
    "tsconfig.eslint.json": "{}",
  };

  for (const [relativePath, contents] of Object.entries({ ...baseFiles, ...extraFiles })) {
    const fullPath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents);
  }

  return repoRoot;
}

function noMatchRg() {
  const error = new Error("no matches");
  error.status = 1;
  throw error;
}

describe("runBoundaryCheck", () => {
  it("passes for a clean OSS-only fixture", () => {
    const repoRoot = createRepoFixture();

    const result = runBoundaryCheck({
      rootDir: repoRoot,
      execFileSyncImpl: noMatchRg,
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("fails when package.json depends on the commercial SDK", () => {
    const repoRoot = createRepoFixture({
      "package.json": JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            "@bitwarden/sdk-internal": "0.0.0-test",
            "@bitwarden/commercial-sdk-internal": "0.0.0-test",
          },
        },
        null,
        2,
      ),
    });

    const result = runBoundaryCheck({
      rootDir: repoRoot,
      execFileSyncImpl: noMatchRg,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "package.json still depends on @bitwarden/commercial-sdk-internal.",
    );
  });

  it("fails when the licensed source tree exists", () => {
    const repoRoot = createRepoFixture({
      "bitwarden_license/README.md": "licensed content",
    });

    const result = runBoundaryCheck({
      rootDir: repoRoot,
      execFileSyncImpl: noMatchRg,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Commercial source tree still exists at bitwarden_license/. Remove it to keep the repo OSS-only.",
    );
  });

  it("fails when licensed path references are found", () => {
    const repoRoot = createRepoFixture();
    const execFileSyncImpl = jest.fn((command, args) => {
      expect(command).toBe("rg");

      if (args.includes(LICENSED_PATH_PATTERNS[0])) {
        return "angular.json:16:root: bitwarden_license/bit-web";
      }

      return noMatchRg();
    });

    const result = runBoundaryCheck({
      rootDir: repoRoot,
      execFileSyncImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Licensed path references remain:\nangular.json:16:root: bitwarden_license/bit-web",
    );
  });

  it("fails when restricted imports are found", () => {
    const repoRoot = createRepoFixture();
    const execFileSyncImpl = jest.fn((command, args) => {
      expect(command).toBe("rg");

      if (args.includes(RESTRICTED_IMPORT_PATTERNS[0])) {
        return "apps/browser/src/main.ts:1:import x from '@bitwarden/bit-common/foo';";
      }

      return noMatchRg();
    });

    const result = runBoundaryCheck({
      rootDir: repoRoot,
      execFileSyncImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Restricted import references remain:\napps/browser/src/main.ts:1:import x from '@bitwarden/bit-common/foo';",
    );
  });

  it("searches workflow and workspace config surfaces for regressions", () => {
    const args = buildRgArgs(LICENSED_PATH_PATTERNS, []);

    expect(args).toEqual(
      expect.arrayContaining([
        ".github",
        ".storybook",
        ".claude",
        "angular.json",
        "clients.code-workspace",
        "jest.config.js",
        "package.json",
      ]),
    );
    expect(args).toEqual(expect.arrayContaining(SEARCH_TARGETS));
  });
});
