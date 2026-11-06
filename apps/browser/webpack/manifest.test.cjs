const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { transform } = require("./manifest");

test("transforms browser prefixes inside manifest resource arrays", () => {
  const template = fs.readFileSync(path.join(__dirname, "../src/manifest.v3.json"));

  for (const browser of ["chrome", "edge", "firefox", "opera", "safari"]) {
    const output = transform(browser)(template);
    const manifest = JSON.parse(output);

    assert.doesNotMatch(output, /__(chrome|edge|firefox|opera|safari)__/);
    assert.deepEqual(
      manifest.web_accessible_resources[0].resources,
      JSON.parse(template).web_accessible_resources[0].resources,
    );
    if (browser === "chrome") {
      assert.equal(manifest.web_accessible_resources[0].use_dynamic_url, true);
    } else {
      assert.equal("use_dynamic_url" in manifest.web_accessible_resources[0], false);
    }
  }
});

test("handles nested arrays, primitive entries, and null overrides", () => {
  const template = Buffer.from(
    JSON.stringify({
      entries: [[null, "value", { enabled: true, __firefox__enabled: null }]],
    }),
  );

  assert.deepEqual(JSON.parse(transform("firefox")(template)), {
    entries: [[null, "value", {}]],
  });
});
