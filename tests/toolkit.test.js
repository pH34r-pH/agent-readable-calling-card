const test = require("node:test");
const assert = require("node:assert/strict");
const ARCC = require("../toolkit/arcc.js");

test("default configuration is valid", () => {
  const result = ARCC.validateConfig(ARCC.DEFAULT_CONFIG);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("canonical typography uses only the pinned font families", () => {
  assert.deepEqual(ARCC.FONT_FAMILIES, {
    sans: "DejaVu Sans",
    mono: "DejaVu Sans Mono"
  });
  assert.equal(ARCC.validateConfig({ theme: { fontFamily: "system-ui" } }).valid, false);
  assert.equal(ARCC.validateConfig({ theme: { monoFamily: "monospace" } }).valid, false);
});

test("renderer is deterministic for the same configuration", () => {
  const a = ARCC.renderSvg(ARCC.DEFAULT_CONFIG);
  const b = ARCC.renderSvg(ARCC.DEFAULT_CONFIG);
  assert.equal(a, b);
});

test("rendered SVG carries the recipe URL in visible text", () => {
  const svg = ARCC.renderSvg({
    recipeUrl: "https://example.org/card.md"
  });
  assert.match(svg, /https:\/\/example\.org\/card\.md/);
  assert.match(svg, /AGENT-READABLE CALLING CARD/);
  assert.match(svg, /USE PUBLIC READ-ONLY SOURCES ONLY/);
});

test("unsafe or ambiguous recipe URL is rejected", () => {
  for (const recipeUrl of [
    "http://example.org/card.md",
    "javascript:alert(1)",
    "/card.md",
    "not a url"
  ]) {
    const result = ARCC.validateConfig({ recipeUrl });
    assert.equal(result.valid, false, recipeUrl);
  }
});

test("XML-sensitive identity text is escaped", () => {
  const svg = ARCC.renderSvg({
    identity: { name: "A & B <Research>", role: "R&D" }
  });
  assert.match(svg, /A &amp; B &lt;Research&gt;/);
  assert.match(svg, /R&amp;D/);
});
