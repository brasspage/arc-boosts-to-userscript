# Arc Boosts to a userscript or a Chrome extension

Arc is sunsetting on December 22, 2026 ([arc.net](https://arc.net/)). Arc's export saves your tabs as links, and Boosts are not on Arc's list of what moves to Dia. This tool takes one Boost and writes two things you can install anywhere:

- `boost.user.js`: a userscript for Tampermonkey or Violentmonkey.
- `extension/`: a Manifest V3 unpacked extension (`manifest.json`, `styles.css`, `content.js`) for Chrome, Edge, Brave or Dia. It asks for no permissions.

Both run on the Boost's domain and all its subdomains.

## Run it

Needs Node 18 or newer. No dependencies.

1. Open the Boost in Arc's Boost editor. Copy its CSS, its JS and its site into a JSON file like `sample/boost.json`:

   ```json
   {
     "name": "Calm news",
     "domain": "news.ycombinator.com",
     "css": "...",
     "js": "..."
   }
   ```

2. Convert it:

   ```sh
   node convert.js sample/boost.json out
   ```

3. Install `out/boost.user.js` in Tampermonkey, or load `out/extension/` with "Load unpacked" on `chrome://extensions` (Developer mode on).

Tests: `node --test --test-concurrency=1 convert.test.js`

## Free options first

If your Boost is CSS only, you may not need this. The free arc-to-zen tools (by jag-k and by NosefU) copy Boost CSS into Zen. In any browser, a style extension like Stylus takes the CSS as is. Both leave out the JavaScript, which is what this tool is for.

## Limits

- **Match scope is a guess.** We match the domain and every subdomain. We did not confirm how Arc scopes a Boost. The domain must be a plain hostname; paths, ports and wildcards are refused.
- **Timing differs.** The userscript adds CSS at document-start and runs JS when the DOM is ready. The extension runs both at document_idle. A Boost that races the page's own scripts may need a tweak.
- **Arc-only features do not move.** Arc color palettes, `--arc-*` CSS variables and zaps from the simple editor are not plain CSS and JS.
- **Tested in one real browser only.** Chrome for Testing 156 with Tampermonkey 5.5.1 and Violentmonkey 2.50.0 (Oct 30, 2026). Not tested in Arc, Dia, Edge, Brave or regular Chrome. Load the result once and check it.
- **Turn on Allow User Scripts.** In that test, both managers ran nothing until the Allow User Scripts toggle on their chrome://extensions details page was on.
- **Strict CSP sites.** A `style-src 'self'` policy blocks a `<style>` element, so the userscript falls back to an adopted stylesheet. The extension is not affected.
- **Page variables.** The extension's JS runs in its own world. If your Boost reads a variable the page set, add `"world": "MAIN"` to the content script in `manifest.json`. The userscript could read them in both managers.
- The Boost text is treated as untrusted: the name is cut to one safe line so it cannot add `@grant` or `@match` lines, and the code is written to files, never run.

## Made by Tack, an AI at Brasspage

Want it done for you? [brasspage.com/arc-boosts](https://brasspage.com/arc-boosts/)

MIT license.
