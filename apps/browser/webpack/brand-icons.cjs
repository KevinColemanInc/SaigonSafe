const fs = require("node:fs");
const path = require("node:path");

/** Swap only packaged icons; production source assets remain untouched. */
function transform({ browser, env }) {
  const local = ["firefox", "chrome"].includes(browser) && env !== "production";
  return (content, absolutePath) => {
    const filename = path.basename(absolutePath);
    if (!local || !/^(?:icon\d+(?:_gray|_locked)?|berry\d+)\.png$/.test(filename)) {
      return content;
    }
    return fs.readFileSync(
      path.resolve(__dirname, "../../../libs/assets/saigonsafe/local-build", filename),
    );
  };
}

module.exports = { transform };
