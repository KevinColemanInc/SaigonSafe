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

test("MV3 uses the appropriate background mechanism for each browser", () => {
  const template = fs.readFileSync(path.join(__dirname, "../src/manifest.v3.json"));
  assert.deepEqual(JSON.parse(transform("chrome")(template)).background, {
    service_worker: "background.js",
  });
  assert.deepEqual(JSON.parse(transform("firefox")(template)).background, {
    scripts: ["background.js"],
  });
});

test("toolbar actions use a full pane without a default popup", () => {
  for (const filename of ["manifest.json", "manifest.v3.json"]) {
    const template = fs.readFileSync(path.join(__dirname, "../src", filename));
    for (const browser of ["chrome", "edge", "firefox", "opera", "safari"]) {
      const manifest = JSON.parse(transform(browser)(template));
      assert.equal((manifest.action || manifest.browser_action).default_popup, undefined);
      if (filename === "manifest.v3.json" && ["chrome", "edge"].includes(browser)) {
        assert.equal(manifest.side_panel.default_path, "popup/index.html?uilocation=sidepanel");
      }
    }
  }
});

test("beta manifests retain SaigonSafe identity", () => {
  const previousChannel = process.env.CHANNEL;
  process.env.CHANNEL = "beta";
  try {
    for (const filename of ["manifest.json", "manifest.v3.json"]) {
      const template = fs.readFileSync(path.join(__dirname, "../src", filename));
      const output = JSON.parse(transform("chrome")(template));
      assert.equal(output.short_name, "SaigonSafe Beta");
      assert.equal((output.action || output.browser_action).default_title, "SaigonSafe Beta");
      assert.equal(output.name, "__MSG_extNameBeta__");
    }
  } finally {
    if (previousChannel === undefined) delete process.env.CHANNEL;
    else process.env.CHANNEL = previousChannel;
  }
});
