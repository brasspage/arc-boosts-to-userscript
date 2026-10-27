#!/usr/bin/env node
// Usage: node convert.js <boost.json> <out dir>
// One Arc Boost (name, domain, css, js, pasted by the
// buyer from Arc's Boost editor) becomes a userscript (Tampermonkey or Violentmonkey) and a Manifest V3
// unpacked extension (content script plus stylesheet) for Chrome, Edge, Brave or Dia.
// The Boost text is untrusted: the domain must be a plain hostname, the name is cut to one safe line,
// and the code is never run here, only written to files.
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const HOST =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

// Pure. Checks a Boost and returns a clean copy, or throws.
function clean(b) {
  if (!b || typeof b !== "object") throw new Error("boost must be an object");
  const domain = String(b.domain || "")
    .trim()
    .toLowerCase();
  if (!HOST.test(domain)) throw new Error(`not a plain hostname: ${domain}`);
  const name =
    String(b.name || domain)
      .replace(/[^\w .,()'-]/g, "")
      .trim()
      .slice(0, 60) || domain;
  const css = typeof b.css === "string" ? b.css : "";
  const js = typeof b.js === "string" ? b.js : "";
  if (!css && !js) throw new Error("boost has no css and no js");
  return { name, domain, css, js };
}

// Arc Boosts apply to the domain and its subdomains, so both are matched.
const matches = (d) => [`*://${d}/*`, `*://*.${d}/*`];

// Pure. The userscript text. CSS goes in at document-start; the JS runs once the DOM is ready.
function userscript(boost) {
  const b = clean(boost);
  const head = [
    "// ==UserScript==",
    `// @name         ${b.name} (from Arc Boost)`,
    "// @namespace    brasspage.com/arc-boosts",
    "// @version      1.0",
    ...matches(b.domain).map((m) => `// @match        ${m}`),
    "// @run-at       document-start",
    "// @grant        none",
    "// ==/UserScript==",
  ];
  const body = [
    "(() => {",
    `  const css = ${JSON.stringify(b.css)};`,
    "  if (css) {",
    '    const s = document.createElement("style");',
    "    s.textContent = css;",
    "    (document.head || document.documentElement).appendChild(s);",
    "  }",
    "  const run = () => {",
    b.js
      .split("\n")
      .map((l) => (l ? "    " + l : l))
      .join("\n"),
    "  };",
    '  if (document.readyState === "loading")',
    '    document.addEventListener("DOMContentLoaded", run, { once: true });',
    "  else run();",
    "})();",
  ];
  return head.join("\n") + "\n\n" + body.join("\n") + "\n";
}

// Pure. The MV3 extension as { file name: text }.
function extension(boost) {
  const b = clean(boost);
  const cs = { matches: matches(b.domain), run_at: "document_idle" };
  const files = {};
  if (b.css) {
    cs.css = ["styles.css"];
    files["styles.css"] = b.css;
  }
  if (b.js) {
    cs.js = ["content.js"];
    files["content.js"] = b.js;
  }
  files["manifest.json"] =
    JSON.stringify(
      {
        manifest_version: 3,
        name: `${b.name} (from Arc Boost)`,
        version: "1.0",
        description: `Arc Boost for ${b.domain}, moved by Brasspage.`,
        content_scripts: [cs],
      },
      null,
      2,
    ) + "\n";
  return files;
}

function main([inFile, outDir]) {
  if (!inFile || !outDir) {
    console.error("usage: node convert.js <boost.json> <out dir>");
    process.exit(2);
  }
  const b = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const ext = path.join(outDir, "extension");
  fs.mkdirSync(ext, { recursive: true });
  fs.writeFileSync(path.join(outDir, "boost.user.js"), userscript(b));
  for (const [f, t] of Object.entries(extension(b)))
    fs.writeFileSync(path.join(ext, f), t);
  console.log(`wrote ${outDir}/boost.user.js and ${ext}/`);
}

module.exports = { clean, userscript, extension };
if (require.main === module) main(process.argv.slice(2));
