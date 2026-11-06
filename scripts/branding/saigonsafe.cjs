// Canonical, code-native SaigonSafe artwork. No upstream logo geometry.
const colors = { jade: "#087F70", ink: "#123F39", cream: "#FFF8E9", coral: "#F27760" };
const sPath = "M42 20H29C17 20 17 32 29 32H35C47 32 47 44 35 44H22";
const wrap = (body, width = 64, height = width, viewBox = `0 0 ${width} ${height}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" fill="none">${body}</svg>`;

function mark({
  gray = false,
  locked = false,
  notification = false,
  mono = false,
  local = false,
} = {}) {
  const base = local ? (gray ? "#7B6C91" : "#7952C7") : gray ? "#657C77" : colors.jade;
  const badge = locked
    ? `<circle cx="49" cy="49" r="14" fill="${colors.cream}" stroke="${colors.ink}" stroke-width="2"/><path d="M44 48v-4a5 5 0 0 1 10 0v4" stroke="${colors.ink}" stroke-width="3"/><rect x="42" y="47" width="14" height="11" rx="3" fill="${colors.ink}"/><circle cx="49" cy="52" r="1.5" fill="${colors.cream}"/>`
    : "";
  return wrap(
    `${mono ? "" : `<rect x="2" y="2" width="60" height="60" rx="18" fill="${base}"/>`}<path d="${sPath}" stroke="${mono ? "#000" : colors.cream}" stroke-width="7" stroke-linecap="round"/><circle cx="49" cy="14" r="5" fill="${mono ? "#000" : local ? "#E9C86B" : gray ? "#C3D0CB" : colors.coral}"/>${badge}${notification ? `<circle cx="53" cy="11" r="10" fill="${local ? "#E9C86B" : colors.coral}" stroke="${colors.cream}" stroke-width="3"/>` : ""}`,
  );
}

function wordmark(light = false) {
  return wrap(
    `<svg width="86" height="86" viewBox="0 0 64 64">${mark().match(/<svg[^>]*>(.*)<\/svg>/s)[1]}</svg><text x="104" y="72" fill="${light ? colors.cream : colors.ink}" font-family="Arial,Helvetica,sans-serif" font-size="82" font-weight="700" letter-spacing="-3">SaigonSafe</text>`,
    568,
    86,
  );
}

function search(theme) {
  const ink = theme === "dark" ? "#B8E1D4" : theme === "solarized" ? "#8D7653" : colors.jade;
  return wrap(
    `<circle cx="55" cy="51" r="33" fill="${ink}" opacity=".08"/><circle cx="52" cy="49" r="23" stroke="${ink}" stroke-width="5"/><path d="m70 67 25 25M44 49h16m-8-8v16" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><circle cx="94" cy="24" r="6" fill="${colors.coral}"/>`,
    120,
  );
}

function glyph(kind, color = colors.jade) {
  const body =
    kind === "close"
      ? '<path d="m8 8 16 16M24 8 8 24"/>'
      : kind === "passkey"
        ? '<circle cx="12" cy="12" r="7"/><path d="m17 17 11 11m-4-4 3-3m-7-1 3-3"/>'
        : '<circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="5" ry="12"/><path d="M4 16h24"/>';
  return wrap(
    `<g stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`,
    32,
  );
}

// These are instructional illustrations, with the existing steps and dimensions.
function carousel(kind, dark) {
  const accent = dark ? "#8FD6BF" : colors.jade;
  const bg = dark ? "#132D29" : "#F2F7F3";
  const panel = dark ? "#203F38" : "#FFFFFF";
  const text = dark ? colors.cream : colors.ink;
  const muted = dark ? "#ACCAC0" : "#59796E";
  const edge = dark ? "#3D6156" : "#D7E5DC";
  const title =
    kind === "generate_password"
      ? "Use generated password"
      : kind === "update_login"
        ? "Update saved login"
        : "Review at-risk logins";
  const caption =
    kind === "generate_password"
      ? "A stronger password, in one click"
      : kind === "update_login"
        ? "Keep your vault up to date"
        : "A safer vault starts here";
  const content =
    kind === "generate_password"
      ? `<rect x="72" y="193" width="720" height="82" rx="18" fill="${panel}" stroke="${accent}" stroke-width="3"/><text x="100" y="245" fill="${muted}" font-family="Arial" font-size="26">New password</text><svg x="725" y="209" width="48" height="48" viewBox="0 0 64 64">${mark().match(/<svg[^>]*>(.*)<\/svg>/s)[1]}</svg><rect x="72" y="291" width="720" height="164" rx="20" fill="${panel}" stroke="${edge}" stroke-width="2"/><svg x="100" y="328" width="52" height="52" viewBox="0 0 32 32">${glyph("passkey").match(/<svg[^>]*>(.*)<\/svg>/s)[1]}</svg><text x="176" y="347" fill="${text}" font-family="Arial" font-size="29">Use generated password</text><text x="176" y="401" fill="${accent}" font-family="monospace" font-size="31">r7!Nk4#Lq9%Ws2</text><path d="m724 355 12 12-12 12" stroke="${colors.coral}" stroke-width="5" stroke-linecap="round"/>`
      : kind === "update_login"
        ? `<rect x="72" y="192" width="720" height="262" rx="24" fill="${panel}" stroke="${edge}" stroke-width="2"/><svg x="102" y="221" width="56" height="56" viewBox="0 0 64 64">${mark().match(/<svg[^>]*>(.*)<\/svg>/s)[1]}</svg><text x="179" y="247" fill="${text}" font-family="Arial" font-size="29" font-weight="700">Save your new password?</text><text x="179" y="282" fill="${muted}" font-family="Arial" font-size="23">Update this login in SaigonSafe.</text><rect x="104" y="323" width="656" height="1" fill="${edge}"/><text x="105" y="382" fill="${muted}" font-family="Arial" font-size="24">Not now</text><rect x="538" y="345" width="222" height="66" rx="18" fill="${colors.jade}"/><text x="649" y="387" fill="${colors.cream}" font-family="Arial" font-size="25" text-anchor="middle">Update login</text>`
        : `<rect x="72" y="192" width="720" height="262" rx="24" fill="${panel}" stroke="${edge}" stroke-width="2"/>${["Weak passwords", "Reused passwords", "Exposed passwords"].map((label, i) => `<circle cx="112" cy="241" r="8" fill="${colors.coral}" transform="translate(0 ${i * 78})"/><text x="140" y="250" fill="${text}" font-family="Arial" font-size="27" transform="translate(0 ${i * 78})">${label}</text><path d="m735 ${233 + i * 78} 9 9-9 9" stroke="${muted}" stroke-width="3" stroke-linecap="round"/>`).join("")}`;
  return wrap(
    `<rect width="864" height="573" rx="32" fill="${bg}"/><circle cx="832" cy="20" r="165" fill="${accent}" opacity=".06"/><text x="72" y="72" fill="${accent}" font-family="Arial" font-size="18" font-weight="700" letter-spacing="3">SAIGONSAFE</text><text x="72" y="113" fill="${text}" font-family="Arial" font-size="36" font-weight="700">${title}</text><text x="72" y="151" fill="${muted}" font-family="Arial" font-size="23">${caption}</text>${content}<rect x="72" y="504" width="32" height="7" rx="3.5" fill="${accent}"/><circle cx="121" cy="507.5" r="3.5" fill="${edge}"/><circle cx="138" cy="507.5" r="3.5" fill="${edge}"/>`,
    864,
    573,
  );
}

function illustration(kind, dark) {
  const bg = dark ? "#203F38" : "#E8F3ED";
  const ink = dark ? "#B8E1D4" : colors.jade;
  return wrap(
    `<circle cx="48" cy="48" r="43" fill="${bg}"/>${kind === "keyhole" ? `<rect x="24" y="37" width="48" height="41" rx="13" fill="${ink}"/><path d="M34 39V28a14 14 0 0 1 28 0v11" stroke="${ink}" stroke-width="7"/><circle cx="48" cy="55" r="5" fill="${dark ? colors.ink : colors.cream}"/><path d="M48 58v7" stroke="${dark ? colors.ink : colors.cream}" stroke-width="4" stroke-linecap="round"/>` : `<circle cx="48" cy="48" r="25" fill="${ink}"/><path d="m35 48 9 9 18-19" stroke="${dark ? colors.ink : colors.cream}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="m17 24 5 5m51 42 5 5M72 20l-3 7M22 68l-5 2" stroke="${colors.coral}" stroke-width="5" stroke-linecap="round"/>`}<circle cx="76" cy="20" r="6" fill="${colors.coral}"/>`,
    96,
  );
}

module.exports = { colors, sPath, wrap, mark, wordmark, search, glyph, carousel, illustration };
