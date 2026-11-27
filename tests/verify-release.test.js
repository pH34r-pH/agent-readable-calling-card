const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { renderCard, sha256 } = require("../scripts/render-card.js");
const { stageRelease } = require("../scripts/stage-release.js");
const { verifyRelease } = require("../scripts/verify-release.js");
const { verifyWebRelease } = require("../scripts/verify-web-release.js");

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

test("Web verification observes only the pinned recipe and records exact inline text", async t => {
  const { root, manifest, sign } = stagedRelease(t);
  const bundleDigest = sha256(sign());
  const recipe = fs.readFileSync(path.join(root, "card.md"));
  const requests = [];
  const result = await verifyWebRelease(root, publicKey, REVISION, bundleDigest, "https://example.org", {
    clock: () => NOW,
    request: async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, "manual");
      assert.equal(options.credentials, "omit");
      return new Response(recipe, { headers: {
        "Content-Type": 'text/markdown; charset="UTF-8"; variant=GFM',
        "Content-Disposition": 'inline; filename="card, recipe.md"'
      } });
    }
  });
  assert.deepEqual(requests, [recipeUrl]);
  assert.deepEqual(result, {
    sourceRevision: REVISION,
    manifestSha256: bundleDigest,
    webEvidence: {
      transformation: "web-resolution", result: "byte-match", checkedAt: new Date(NOW).toISOString(),
      recipeUrl, redirectTarget: null, redirectStatus: null, status: 200, recipeSha256: manifest.recipe.sha256,
      mediaType: "text/markdown", contentDisposition: "inline", bytes: recipe.length
    }
  });
});

test("Web verification follows only the signed single redirect", async t => {
  const { root, manifest, sign } = stagedRelease(t);
  const target = "https://example.org/canonical/card.md";
  manifest.recipe.redirectTarget = target;
  const approved = sha256(sign());
  const recipe = fs.readFileSync(path.join(root, "card.md"));
  const cases = [
    ["/canonical/card.md", null, [recipeUrl, target]],
    ["https://example.net/card.md", /does not match/, [recipeUrl]],
    ["http://example.org/canonical/card.md", /does not match/, [recipeUrl]],
    ["/other.md", /does not match/, [recipeUrl]],
    [null, /does not match/, [recipeUrl]]
  ];
  for (const [location, error, urls] of cases) {
    const seen = [];
    const verification = verifyWebRelease(root, publicKey, REVISION, approved, "https://example.org", {
      clock: () => NOW,
      request: async url => {
        seen.push(url);
        return url === recipeUrl
          ? new Response(null, { status: 302, headers: location === null ? {} : { location } })
          : new Response(recipe, { headers: { "Content-Type": "text/plain" } });
      }
    });
    if (error) {
      await assert.rejects(verification, error);
    } else {
      const { webEvidence } = await verification;
      assert.equal(webEvidence.redirectStatus, 302);
      assert.equal(webEvidence.redirectTarget, target);
    }
    assert.deepEqual(seen, urls);
  }
  const unexpected = verifyWebRelease(root, publicKey, REVISION, approved, "https://example.org", {
    clock: () => NOW,
    request: async url => new Response(null, {
      status: 302, headers: { location: url === recipeUrl ? target : "/chain/card.md" }
    })
  });
  await assert.rejects(unexpected, /HTTP 200/);
});

test("Web verification rejects unreviewed origin and release before making a request", async t => {
  const { root, sign } = stagedRelease(t);
  const approved = sha256(sign());
  const options = {
    clock: () => NOW,
    request: async () => assert.fail("an unreviewed release cannot make a request")
  };
  await assert.rejects(
    verifyWebRelease(root, publicKey, REVISION, "0".repeat(64), "https://example.org", options),
    /approved manifest digest/
  );
  await assert.rejects(
    verifyWebRelease(root, publicKey, REVISION, approved, "https://example.net", options),
    /approved deployment origin/
  );
});

test("Web verification rejects HTML, attachment, wrong encoding, stale review, and mismatched bytes", async t => {
  const { root, manifest, write, sign } = stagedRelease(t);
  const approved = sha256(sign());
  const recipe = fs.readFileSync(path.join(root, "card.md"));
  const plain = { "Content-Type": "text/plain; charset=utf-8" };
  const options = [
    [recipe, { "Content-Type": "text/html" }, /inline text/],
    [recipe, { "Content-Type": "text/plain; variant=GFM, text/html" }, /inline text/],
    [recipe, { ...plain, "Content-Disposition": "attachment" }, /require a download/],
    [recipe, { ...plain, "Content-Disposition": 'inline; filename="card.md", attachment' }, /require a download/],
    [recipe, { "Content-Type": "text/plain; charset=iso-8859-1" }, /must use UTF-8/],
    [recipe, plain, /validity window/, Date.parse(manifest.expiresAt)],
    [Buffer.from("Replaced recipe"), plain, /digest does not match/],
    [Buffer.alloc(256 * 1024 + 1), plain, /exceeds its size limit/]
  ];
  for (const [bytes, headers, error, checkedAt = NOW] of options) {
    const times = [NOW, checkedAt];
    await assert.rejects(verifyWebRelease(root, publicKey, REVISION, approved, "https://example.org", {
      clock: () => times.shift(),
      request: async () => new Response(bytes, { headers })
    }), error);
  }
  const binary = Buffer.from([0xff, 0xfe]);
  write("card.md", binary);
  manifest.recipe.sha256 = sha256(binary);
  await assert.rejects(verifyWebRelease(root, publicKey, REVISION, sha256(sign()), "https://example.org", {
    clock: () => NOW,
    request: async () => new Response(binary, { headers: plain })
  }), /not valid UTF-8/);
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

function reviewedInputs(t) {
  const { directory, root, manifest } = stagedRelease(t);
  const inputs = path.join(directory, "reviewed");
  const destination = path.join(directory, "unsigned");
  fs.mkdirSync(path.join(inputs, "sources"), { recursive: true });
  for (const name of ["card.json", "card.md", "sources/example.md"]) {
    fs.copyFileSync(path.join(root, name), path.join(inputs, name));
  }
  const { renderManifestSha256: _render, transformations: _steps, ...reviewed } = manifest;
  const plan = { ...reviewed, configuration: { file: "card.json", sha256: sha256(config) } };
  function writePlan() {
    const bytes = Buffer.from(JSON.stringify(plan, null, 2) + "\n");
    fs.writeFileSync(path.join(inputs, "stage-plan.json"), bytes);
    return sha256(bytes);
  }
  return { inputs, destination, plan, writePlan };
}

test("a staged bundle reproduces byte for byte and passes the existing verifier after signing", t => {
  const { inputs, destination, writePlan } = reviewedInputs(t);
  const pin = writePlan();
  const receipt = stageRelease(inputs, pin, REVISION, destination, NOW);
  assert.deepEqual(fs.readdirSync(destination).sort(), [
    "card.json", "card.manifest.json", "card.md", "card.png", "card.svg", "release.json", "sources"
  ]);
  const second = destination + "-repeat";
  assert.deepEqual(stageRelease(inputs, pin, REVISION, second, NOW), receipt);
  for (const name of [
    "card.json", "card.manifest.json", "card.md", "card.png", "card.svg",
    "release.json", "sources/example.md"
  ]) {
    assert.deepEqual(fs.readFileSync(path.join(second, name)), fs.readFileSync(path.join(destination, name)));
  }
  const manifest = fs.readFileSync(path.join(destination, "release.json"));
  assert.deepEqual(receipt, {
    sourceRevision: REVISION, planSha256: pin, manifestSha256: sha256(manifest), status: "prepared-unsigned"
  });
  fs.writeFileSync(path.join(destination, "release.sig"), crypto.sign(null, manifest, privateKey));
  assert.deepEqual(verifyRelease(destination, publicKey, REVISION, NOW), {
    sourceRevision: REVISION, manifestSha256: receipt.manifestSha256
  });
});

test("staging rejects changed or invalid reviewed inputs before creating a bundle", async t => {
  for (const [description, change, expected] of [
    ["wrong plan pin", f => { f.writePlan(); return "b".repeat(64); }, /Reviewed staging plan digest/],
    ["stale observation", f => { f.plan.recipe.freshUntil = OBSERVED; return f.writePlan(); }, /freshness/],
    ["different source revision", f => { f.plan.sourceRevision = "b".repeat(40); return f.writePlan(); }, /source revision/],
    ["changed configuration", f => {
      const pin = f.writePlan();
      fs.writeFileSync(path.join(f.inputs, "card.json"), "{}");
      return pin;
    }, /Card configuration digest/],
    ["changed recipe", f => {
      const pin = f.writePlan();
      fs.writeFileSync(path.join(f.inputs, "card.md"), "Other reviewed text");
      return pin;
    }, /Recipe snapshot digest/],
    ["unreviewed source", f => {
      const pin = f.writePlan();
      fs.writeFileSync(path.join(f.inputs, "sources/extra.txt"), "Extra text");
      return pin;
    }, /unadmitted files/],
    ["different recipe URL", f => {
      f.plan.recipe.url = "https://example.org/alternate.md";
      return f.writePlan();
    }, /different recipes/]
  ]) {
    await t.test(description, child => {
      const fixture = reviewedInputs(child);
      const pin = change(fixture);
      assert.throws(() => stageRelease(fixture.inputs, pin, REVISION, fixture.destination, NOW), expected);
      assert.equal(fs.existsSync(fixture.destination), false);
    });
  }
});

test("staging preserves an existing destination and can retry after an interrupted write", t => {
  const { inputs, destination, writePlan } = reviewedInputs(t);
  const pin = writePlan();
  const existing = destination + "-existing";
  fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, "keep.txt"), "Existing bundle");
  assert.throws(() => stageRelease(inputs, pin, REVISION, existing, NOW), /EEXIST/);
  assert.deepEqual(fs.readdirSync(existing), ["keep.txt"]);
  assert.equal(fs.readFileSync(path.join(existing, "keep.txt"), "utf8"), "Existing bundle");

  const write = fs.writeFileSync;
  let writes = 0;
  try {
    fs.writeFileSync = (...args) => {
      if (typeof args[0] === "number" && ++writes === 3) throw new Error("Synthetic write failure");
      return write(...args);
    };
    assert.throws(() => stageRelease(inputs, pin, REVISION, destination, NOW), /Synthetic write failure/);
  } finally {
    fs.writeFileSync = write;
  }
  assert.equal(fs.existsSync(destination), false);
  assert.equal(stageRelease(inputs, pin, REVISION, destination, NOW).status, "prepared-unsigned");
});
