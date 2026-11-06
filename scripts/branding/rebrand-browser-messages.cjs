// Keep first-party text branded while preserving actual external product names.
const fs = require("node:fs");
const path = require("node:path");
const locales = path.resolve(__dirname, "../../apps/browser/src/_locales");
const externalKeys = new Set([
  "bitwardenAuthenticator",
  "bitwardenForBusiness",
  "bitwardenForBusinessPageDesc",
  "continueToAuthenticatorPageDesc",
  "bitwardenSecretsManager",
  "continueToSecretsManagerPageDesc",
  "freeBitwardenFamilies",
  "freeBitwardenFamiliesPageDesc",
  "downloadBitwardenApps",
  "nativeMessagingPermissionErrorDesc",
  "receiveMarketingEmails",
  "bitwardenSupport",
]);
let changed = 0;
for (const locale of fs.readdirSync(locales)) {
  const file = path.join(locales, locale, "messages.json");
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let dirty = false;
  for (const [key, value] of Object.entries(data)) {
    if (externalKeys.has(key) || !value.message.includes("Bitwarden")) continue;
    const message = value.message
      .replace(/Bitwarden browser extension/g, "SaigonSafe browser extension")
      .replace(
        /Bitwarden(?! (?:Desktop|desktop|Customer Support|support|Authenticator|Secrets Manager|Families))/g,
        "SaigonSafe",
      );
    if (message !== value.message) {
      dirty = true;
      value.message = message;
    }
  }
  if (dirty) {
    if (process.argv.includes("--check")) throw new Error(`Upstream app branding in ${file}`);
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    changed++;
  }
}
console.log(
  `SaigonSafe browser text ${process.argv.includes("--check") ? "verified" : `updated in ${changed} locales`}.`,
);
