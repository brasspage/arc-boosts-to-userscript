// Run: node --test --test-concurrency=1 convert.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { userscript, extension, clean } = require("./convert.js");
const sample = require("./sample/boost.json");

test("userscript: header, @match lines, CSS and JS both applied on a fake page", () => {
  const u = userscript(sample);
  assert.match(u, /^\/\/ ==UserScript==\n/);
  assert.match(u, /^\/\/ @match {8}\*:\/\/news\.ycombinator\.com\/\*$/m);
  assert.match(u, /^\/\/ @match {8}\*:\/\/\*\.news\.ycombinator\.com\/\*$/m);
  assert.match(u, /^\/\/ @run-at {7}document-start$/m);
  assert.match(u, /^\/\/ ==\/UserScript==$/m);
  // Run it against a tiny fake DOM: the style lands and the Boost JS runs.
  const added = [];
  const users = [{ style: {} }, { style: {} }];
  const document = {
    readyState: "complete",
    head: { appendChild: (n) => added.push(n) },
    createElement: (tag) => ({ tag }),
    querySelectorAll: (q) => (q === ".hnuser" ? users : []),
  };
  vm.runInNewContext(u, { document });
  assert.strictEqual(added.length, 1);
  assert.strictEqual(added[0].tag, "style");
  assert.strictEqual(added[0].textContent, sample.css);
  assert.deepStrictEqual(
    users.map((x) => x.style.fontWeight),
    ["bold", "bold"],
  );
});

test("extension: valid MV3 manifest, same matches, files the manifest names exist", () => {
  const files = extension(sample);
  const m = JSON.parse(files["manifest.json"]);
  assert.strictEqual(m.manifest_version, 3);
  assert.deepStrictEqual(m.content_scripts[0].matches, [
    "*://news.ycombinator.com/*",
    "*://*.news.ycombinator.com/*",
  ]);
  for (const f of [...m.content_scripts[0].css, ...m.content_scripts[0].js])
    assert.ok(files[f], f);
  assert.strictEqual(files["styles.css"], sample.css);
  assert.strictEqual(files["content.js"], sample.js);
  assert.ok(!("permissions" in m) && !("host_permissions" in m));
  const cssOnly = JSON.parse(extension({ ...sample, js: "" })["manifest.json"]);
  assert.ok(!("js" in cssOnly.content_scripts[0]));
});

test("hostile input fails closed: bad domains, header injection, empty boosts", () => {
  for (const domain of [
    "*",
    "<all_urls>",
    "evil.com/*",
    "a.com\n// @grant GM_xmlhttpRequest",
    "localhost",
    "",
    "http://a.com",
  ])
    assert.throws(() => userscript({ ...sample, domain }), domain);
  const u = userscript({
    ...sample,
    name: "x\n// @grant GM_xmlhttpRequest\n// @match *://*/*",
  });
  assert.strictEqual((u.match(/@grant/g) || []).length, 1);
  assert.strictEqual((u.match(/@match/g) || []).length, 2);
  assert.throws(() => clean({ domain: "a.com" }));
});

test("the CLI writes both outputs from the sample", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "arc-boost-"));
  execFileSync(process.execPath, [
    path.join(__dirname, "convert.js"),
    path.join(__dirname, "sample/boost.json"),
    d,
  ]);
  assert.ok(fs.existsSync(path.join(d, "boost.user.js")));
  for (const f of ["manifest.json", "styles.css", "content.js"])
    assert.ok(fs.existsSync(path.join(d, "extension", f)), f);
  fs.rmSync(d, { recursive: true });
});
