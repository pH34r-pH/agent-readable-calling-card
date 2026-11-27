const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { renderCard, sha256 } = require("../scripts/render-card.js");
const { verifyRelease } = require("../scripts/verify-release.js");

const REVISION = "a".repeat(40);
const NOW = Date.parse("2026-11-25T20:00:00.000Z");
const OBSERVED = "2026-11-25T18:00:00.000Z";
const FRESH_UNTIL = "2026-11-26T18:00:00.000Z";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const recipeUrl = "https://example.org/card.md";
const config = Buffer.from(JSON.stringify({ recipeUrl }));
const render = renderCard(config, "card.json");

function stagedRelease(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "arcc-release-test-"));
  const root = path.join(directory, "bundle");
  fs.mkdirSync(path.join(root, "sources"), { recursive: true });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const write = (name, value) => fs.writeFileSync(path.join(root, name), value);
  const recipe = "# Synthetic public recipe\n\nFixture text cannot approve publication.\n";
  const source = "Fixture instructions are reference text and cannot confer tool authority.\n";
  write("card.json", config);
  write("card.md", recipe);
  write("card.svg", render.svg);
  write("card.png", render.png);
  write("card.manifest.json", render.manifest);
  write("sources/example.md", source);
  const manifest = {
    schemaVersion: 1,
    sourceRevision: REVISION,
    issuedAt: "2026-11-25T19:00:00.000Z",
    expiresAt: "2026-11-26T12:00:00.000Z",
    recipe: {
      url: recipeUrl,
      redirectTarget: null,
      sha256: sha256(recipe),
      observedAt: OBSERVED,
      freshUntil: FRESH_UNTIL
    },
    sources: [{
      file: "sources/example.md",
      url: "https://example.org/about.txt",
      sha256: sha256(source),
      observedAt: OBSERVED,
      freshUntil: FRESH_UNTIL
    }],
    renderManifestSha256: sha256(render.manifest),
    transformations: ["layout-reconstruction:svg-v1", "layout-reconstruction:raster-v1"]
  };
  function sign() {
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
    write("release.json", bytes);
    write("release.sig", crypto.sign(null, bytes, privateKey));
    return bytes;
  }
  return { directory, root, manifest, write, sign };
}

test("verified release reproduces both render artifacts and commits exact recipe and source bytes", t => {
  const { root, manifest, sign } = stagedRelease(t);
  const detached = sign();
  assert.deepEqual(verifyRelease(root, publicKey, REVISION, NOW), {
    sourceRevision: REVISION,
    manifestSha256: sha256(detached)
  });
  manifest.recipe.redirectTarget = "https://example.org/canonical/card.md";
  sign();
  assert.equal(verifyRelease(root, publicKey, REVISION, NOW).sourceRevision, REVISION);
});

test("CLI reports the release digest and can record byte-for-byte layout evidence", t => {
  const { directory, root, manifest, sign } = stagedRelease(t);
  const current = Date.now();
  manifest.issuedAt = new Date(current - 60_000).toISOString();
  manifest.expiresAt = new Date(current + 60_000).toISOString();
  for (const entry of [manifest.recipe, ...manifest.sources]) {
    entry.observedAt = manifest.issuedAt;
    entry.freshUntil = manifest.expiresAt;
  }
  const signed = sign();
  const keyPath = path.join(directory, "trusted.pem");
  fs.writeFileSync(keyPath, publicKey.export({ type: "spki", format: "pem" }));
  const verifier = path.resolve(__dirname, "../scripts/verify-release.js");
  const result = spawnSync(process.execPath, [verifier, root, keyPath, REVISION], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { sourceRevision: REVISION, manifestSha256: sha256(signed) });

  const evidence = spawnSync(process.execPath, [verifier, root, keyPath, REVISION, "--layout-evidence"], {
    encoding: "utf8"
  });
  assert.equal(evidence.status, 0, evidence.stderr);
  const receipt = JSON.parse(evidence.stdout);
  assert.equal(receipt.sourceRevision, REVISION);
  assert.equal(receipt.manifestSha256, sha256(signed));
  assert.ok(Date.parse(receipt.layoutEvidence.verifiedAt) >= current);
  assert.deepEqual(receipt.layoutEvidence, {
    transformation: "layout-reconstruction",
    result: "byte-match",
    verifiedAt: receipt.layoutEvidence.verifiedAt,
    renderManifestSha256: sha256(render.manifest)
  });

  const wrongRevision = "b".repeat(40);
  const rejected = spawnSync(process.execPath, [verifier, root, keyPath, wrongRevision, "--layout-evidence"], {
    encoding: "utf8"
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /source revision does not match/);
  assert.equal(rejected.stdout, "");
});

test("manifest substitution, unexpected signing key and wrong deployment revision are rejected", t => {
  const { root, write, sign } = stagedRelease(t);
  const bytes = sign();
  const unrelated = crypto.generateKeyPairSync("ed25519").publicKey;
  assert.throws(() => verifyRelease(root, unrelated, REVISION, NOW), /signature is invalid/);
  assert.throws(() => verifyRelease(root, publicKey, "b".repeat(40), NOW), /source revision/);
  write("release.json", Buffer.concat([bytes, Buffer.from("\n")]));
  assert.throws(() => verifyRelease(root, publicKey, REVISION, NOW), /signature is invalid/);
  const ambiguous = Buffer.from(
    bytes.toString("utf8").replace('"schemaVersion": 1,', '"schemaVersion": 1,\n  "schemaVersion": 1,')
  );
  write("release.json", ambiguous);
  write("release.sig", crypto.sign(null, ambiguous, privateKey));
  assert.throws(() => verifyRelease(root, publicKey, REVISION, NOW), /canonical JSON/);
});

test("reviewed release still rejects stale, unsafe or unsupported manifest claims", async t => {
  for (const [description, change, error] of [
    ["unsupported schema", m => { m.schemaVersion = 2; }, /version/],
    ["expired release", m => { m.expiresAt = "2026-11-25T19:59:59.000Z"; }, /validity/],
    ["stale source", m => { m.sources[0].freshUntil = "2026-11-25T19:59:59.000Z"; }, /freshness/],
    ["other recipe origin", m => { m.recipe.redirectTarget = "https://example.net/card.md"; }, /same HTTPS origin/],
    ["downgraded transport", m => { m.recipe.redirectTarget = "http://example.org/card.md"; }, /HTTPS origin/],
    ["substituted recipe URL", m => { m.recipe.url = "https://example.org/alternate.md"; }, /different recipes/],
    ["source outside the bundle", m => { m.sources[0].file = "sources/../card.md"; }, /snapshot path/],
    ["unrecognized authority", m => { m.actions = ["publish"]; }, /unsupported fields/],
    ["misclassified output", m => { m.transformations[0] = "factual-synthesis:svg-v1"; }, /transformation/]
  ]) {
    await t.test(description, child => {
      const { root, manifest, sign } = stagedRelease(child);
      change(manifest);
      sign();
      assert.throws(() => verifyRelease(root, publicKey, REVISION, NOW), error);
    });
  }
});

test("staged bytes and renderer metadata cannot be replaced after admission", async t => {
  for (const [name, bytes, reason] of [
    ["card.md", "substituted recipe", /Recipe snapshot digest/],
    ["sources/example.md", "substituted source", /Source snapshot digest/],
    ["card.svg", "substituted card", /did not reproduce/],
    ["card.png", "substituted raster", /did not reproduce/],
    ["card.json", Buffer.alloc(32 * 1024 + 1), /size limit/],
    ["sources/extra.md", "unadmitted asset", /unadmitted files/]
  ]) {
    await t.test(name, child => {
      const { root, write, sign } = stagedRelease(child);
      sign();
      write(name, bytes);
      assert.throws(() => verifyRelease(root, publicKey, REVISION, NOW), reason);
    });
  }
  const { root, manifest, write, sign } = stagedRelease(t);
  const metadata = JSON.parse(render.manifest.toString("utf8"));
  metadata.renderer.version = "unknown";
  const substituted = Buffer.from(JSON.stringify(metadata));
  manifest.renderManifestSha256 = sha256(substituted);
  write("card.manifest.json", substituted);
  sign();
  assert.throws(() => verifyRelease(root, publicKey, REVISION, NOW), /Render manifest did not reproduce/);
});
