const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const packageLock = require("../package-lock.json");

const repositoryRoot = path.resolve(__dirname, "..");
const rendererPath = path.join(repositoryRoot, "scripts", "render-card.js");
const configPath = path.join(repositoryRoot, "toolkit", "card.example.json");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("canonical renders are byte-stable and record pinned font provenance", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "arcc-render-test-"));
  try {
    const firstDir = path.join(temporaryRoot, "first");
    const secondDir = path.join(temporaryRoot, "second");
    for (const outputDir of [firstDir, secondDir]) {
      const result = spawnSync(process.execPath, [rendererPath, configPath, outputDir], {
        cwd: repositoryRoot,
        encoding: "utf8"
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }

    const firstPng = fs.readFileSync(path.join(firstDir, "card.png"));
    const secondPng = fs.readFileSync(path.join(secondDir, "card.png"));
    const firstSvg = fs.readFileSync(path.join(firstDir, "card.svg"));
    const secondSvg = fs.readFileSync(path.join(secondDir, "card.svg"));
    const firstManifest = JSON.parse(fs.readFileSync(path.join(firstDir, "card.manifest.json"), "utf8"));
    const secondManifest = JSON.parse(fs.readFileSync(path.join(secondDir, "card.manifest.json"), "utf8"));

    assert.deepEqual(secondPng, firstPng);
    assert.deepEqual(secondSvg, firstSvg);
    assert.equal(firstManifest.renderer.systemFontsLoaded, false);
    assert.equal(firstManifest.renderer.version, require("@resvg/resvg-js/package.json").version);
    assert.equal(firstManifest.renderer.packageIntegrity, packageLock.packages["node_modules/@resvg/resvg-js"].integrity);
    assert.deepEqual(firstManifest.fonts, secondManifest.fonts);
    assert.equal(firstManifest.fonts.length, 3);
    assert.ok(firstManifest.fonts.every(font => font.package === "dejavu-fonts-ttf"));
    assert.ok(firstManifest.fonts.every(font => font.packageVersion === "2.37.3"));
    assert.ok(firstManifest.fonts.every(font => font.packageUrl.endsWith("dejavu-fonts-ttf-2.37.3.tgz")));
    assert.ok(firstManifest.fonts.every(font => font.packageIntegrity === packageLock.packages["node_modules/dejavu-fonts-ttf"].integrity));
    assert.ok(firstManifest.fonts.every(font => font.license.includes("Bitstream Vera")));
    assert.ok(firstManifest.fonts.every(font => font.packageLicenseDeclaration.includes("LICENSE")));
    assert.deepEqual(firstManifest.fonts.map(({ packageFile, sha256: fileHash }) => ({ packageFile, sha256: fileHash })), [
      { packageFile: "ttf/DejaVuSans.ttf", sha256: "7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954" },
      { packageFile: "ttf/DejaVuSans-Bold.ttf", sha256: "e6476c1b80502924294eed40894c5b18e06c181444ca953e5334262df9c27724" },
      { packageFile: "ttf/DejaVuSansMono.ttf", sha256: "b4a6c3e4faab8773f4ff761d56451646409f29abedd68f05d38c2df667d3c582" }
    ]);
    assert.equal(firstManifest.outputs.png.sha256, sha256(firstPng));
    assert.equal(firstManifest.outputs.svg.sha256, sha256(firstSvg));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
