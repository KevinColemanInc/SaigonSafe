const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { transform } = require("../../apps/browser/webpack/brand-icons.cjs");

const root = path.resolve(__dirname, "../..");
const images = path.join(root, "apps/browser/src/images");
const localImages = path.join(root, "libs/assets/saigonsafe/local-build");
const icons = fs.readdirSync(localImages).filter((file) => file.endsWith(".png"));

for (const browser of ["firefox", "chrome"]) {
  test(`${browser}: local app and status icons are purple; production assets stay unchanged`, () => {
    assert.equal(icons.length, 18);
    for (const icon of icons) {
      const file = path.join(images, icon);
      const production = fs.readFileSync(file);
      const local = fs.readFileSync(path.join(localImages, icon));
      assert.notDeepEqual(local, production, icon);
      assert.deepEqual(transform({ browser, env: "development" })(production, file), local, icon);
      assert.strictEqual(
        transform({ browser, env: "production" })(production, file),
        production,
        icon,
      );
      // Dimensions must be identical when webpack swaps the file.
      assert.deepEqual(local.subarray(16, 24), production.subarray(16, 24), icon);
    }
  });
}

test("all manifest app and toolbar icon sizes have branded local variants", () => {
  for (const template of ["manifest.json", "manifest.v3.json"]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "apps/browser/src", template)));
    for (const icon of Object.values(manifest.icons)) {
      assert.ok(icons.includes(path.basename(icon)), icon);
    }
    const action = manifest.action || manifest.browser_action;
    for (const icon of Object.values(action.default_icon)) {
      assert.ok(icons.includes(path.basename(icon)), icon);
    }
  }
});

test("unrelated images and other browsers keep their original assets", () => {
  const bytes = Buffer.from("unrelated image");
  for (const browser of ["chrome", "firefox", "safari", "edge"]) {
    assert.strictEqual(
      transform({ browser, env: "development" })(bytes, "/images/app-store.png"),
      bytes,
    );
  }
  assert.strictEqual(
    transform({ browser: "safari", env: "development" })(bytes, "/images/icon16.png"),
    bytes,
  );
});

test("stable and beta wordmarks use SaigonSafe artwork", () => {
  for (const filename of ["bitwarden-logo.icon.ts", "bitwarden-logo-beta.icon.ts"]) {
    const source = fs.readFileSync(path.join(root, "libs/assets/src/svg/svgs", filename), "utf8");
    assert.match(source, /SaigonSafeLogo/);
    assert.doesNotMatch(source, /<path|<svg/);
  }
  const messages = JSON.parse(
    fs.readFileSync(path.join(root, "apps/browser/src/_locales/en/messages.json")),
  );
  assert.match(messages.extName.message, /SaigonSafe/);
  assert.match(messages.extNameBeta.message, /SaigonSafe/);
});
