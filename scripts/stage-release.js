#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { MAX_CONFIG_BYTES } = require("../toolkit/arcc.js");
const { renderCard, sha256 } = require("./render-card.js");
const {
  canonicalJSON, checkConfigLabel, checkDigest, checkFields, checkReleaseEvidence,
  parseCanonicalJSON, readBundleFile, readReviewedSnapshots, requireCondition, MANIFEST_LIMIT,
  TEXT_LIMIT, PNG_LIMIT, TRANSFORMATIONS
} = require("./verify-release.js");

const INPUTS = ["stage-plan.json", "card.json", "card.md"];

function writeNewBundle(destination, files) {
  const created = [];
  const directories = [destination];
  fs.mkdirSync(destination, { mode: 0o700 });
  try {
    if ([...files.keys()].some(name => name.startsWith("sources/"))) {
      const directory = path.join(destination, "sources");
      fs.mkdirSync(directory, { mode: 0o700 });
      directories.push(directory);
    }
    for (const [name, bytes] of files) {
      const output = path.join(destination, name);
      const fd = fs.openSync(output, "wx", 0o600);
      created.push(output);
      try {
        fs.writeFileSync(fd, bytes);
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch (error) {
    // Roll back only the paths this invocation created.
    for (const filename of created.reverse()) {
      try { fs.unlinkSync(filename); } catch {}
    }
    for (const directory of directories.reverse()) {
      try { fs.rmdirSync(directory); } catch {}
    }
    throw error;
  }
}

function stageRelease(inputs, planSha256, expectedRevision, destination, now = Date.now(), checkout) {
  requireCondition(fs.lstatSync(inputs).isDirectory(), "Reviewed input root must be an ordinary directory");
  const bytes = readBundleFile(inputs, "stage-plan.json", MANIFEST_LIMIT);
  checkDigest(bytes, planSha256, "Reviewed staging plan");
  const plan = parseCanonicalJSON(bytes, "Reviewed staging plan");
  checkFields(plan, [
    "schemaVersion", "sourceRevision", "issuedAt", "expiresAt", "configuration", "recipe", "sources"
  ], "Reviewed staging plan");
  requireCondition(plan.schemaVersion === 1, "Unsupported staging plan version");
  checkFields(plan.configuration, ["file", "sha256"], "Reviewed card configuration");
  checkConfigLabel(plan.configuration.file);
  const sourceNames = checkReleaseEvidence(plan, expectedRevision, now);
  const files = readReviewedSnapshots(inputs, INPUTS, plan, sourceNames);
  const config = readBundleFile(inputs, "card.json", MAX_CONFIG_BYTES);
  checkDigest(config, plan.configuration.sha256, "Card configuration");
  if (checkout !== undefined) {
    const sourceConfig = execFileSync("git", [
      "cat-file", "blob", expectedRevision + ":" + plan.configuration.file
    ], { cwd: checkout, maxBuffer: MAX_CONFIG_BYTES + 1, stdio: ["ignore", "pipe", "ignore"] });
    requireCondition(sourceConfig.equals(config), "Card configuration differs from the reviewed Git file");
  }
  const rendered = renderCard(config, plan.configuration.file);
  requireCondition(rendered.recipeUrl === plan.recipe.url, "Card and release refer to different recipes");
  requireCondition(
    Buffer.byteLength(rendered.svg) <= TEXT_LIMIT && rendered.png.length <= PNG_LIMIT &&
      rendered.manifest.length <= MANIFEST_LIMIT,
    "Staged render exceeds a release verification size limit"
  );
  const manifest = canonicalJSON({
    schemaVersion: 1,
    sourceRevision: plan.sourceRevision,
    issuedAt: plan.issuedAt,
    expiresAt: plan.expiresAt,
    recipe: plan.recipe,
    sources: plan.sources,
    renderManifestSha256: sha256(rendered.manifest),
    transformations: TRANSFORMATIONS
  });
  requireCondition(manifest.length <= MANIFEST_LIMIT, "Staged release manifest exceeds its size limit");
  files.set("card.json", config);
  files.set("card.svg", rendered.svg);
  files.set("card.png", rendered.png);
  files.set("card.manifest.json", rendered.manifest);
  files.set("release.json", manifest);
  writeNewBundle(destination, files);
  return {
    sourceRevision: expectedRevision,
    planSha256,
    manifestSha256: sha256(manifest),
    status: "prepared-unsigned"
  };
}

function checkReviewedCheckout(expectedRevision) {
  const cwd = path.resolve(__dirname, "..");
  const current = execFileSync("git", ["rev-parse", "--verify", "HEAD"], { cwd, encoding: "utf8" });
  requireCondition(current.trim() === expectedRevision, "Checkout differs from the reviewed Git revision");
  try {
    execFileSync("git", ["diff", "HEAD", "--quiet", "--"], { cwd, stdio: "ignore" });
  } catch {
    throw new Error("Use a clean reviewed checkout to stage a release");
  }
  return cwd;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    requireCondition(
      args.length === 4,
      "Usage: node scripts/stage-release.js reviewed-dir reviewed-plan-sha reviewed-git-sha new-bundle-dir"
    );
    const [inputs, planSha256, revision, destination] = args;
    const checkout = checkReviewedCheckout(revision);
    console.log(JSON.stringify(stageRelease(inputs, planSha256, revision, destination, Date.now(), checkout)));
  } catch (error) {
    console.error("Release staging failed:", error.message);
    process.exitCode = 1;
  }
}

module.exports = { stageRelease };
