#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isHttpsUrl, MAX_CONFIG_BYTES } = require("../toolkit/arcc.js");
const { readLocalFile } = require("./read-local-file.js");
const { renderCard, sha256 } = require("./render-card.js");

const MANIFEST_LIMIT = 64 * 1024;
const TEXT_LIMIT = 256 * 1024;
const PNG_LIMIT = 68 * 1024 * 1024;
const REVISION = /^[0-9a-f]{40}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const SOURCE_FILE = /^sources\/[a-z0-9][a-z0-9._-]{0,70}\.(?:md|txt)$/u;
const TRANSFORMATIONS = ["layout-reconstruction:svg-v1", "layout-reconstruction:raster-v1"];
const FIXED_FILES = [
  "card.json", "card.md", "card.svg", "card.png", "card.manifest.json", "release.json",
  "release.sig"
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function checkFields(value, fields, label) {
  requireCondition(
    value !== null && typeof value === "object" && !Array.isArray(value) &&
      Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field)),
    label + " has missing or unsupported fields"
  );
}

function checkInventory(directory, expected) {
  requireCondition(fs.lstatSync(directory).isDirectory(), "Release directories must be ordinary directories");
  const actual = fs.readdirSync(directory);
  requireCondition(
    actual.length === expected.length && expected.every(name => actual.includes(name)),
    "Release contains missing or unadmitted files"
  );
}

function readBundleFile(root, name, limit) {
  const filename = path.join(root, name);
  requireCondition(fs.lstatSync(filename).isFile(), "Release artifacts must be ordinary files");
  return readLocalFile(filename, limit);
}

function parseJSON(bytes) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Release record must contain valid UTF-8 JSON");
  }
}

function isCanonicalHttps(value) {
  return isHttpsUrl(value) && new URL(value).href === value;
}

function checkDigest(bytes, digest, label) {
  requireCondition(
    typeof digest === "string" && DIGEST.test(digest) && sha256(bytes) === digest,
    label + " digest does not match"
  );
}

function timestamp(value) {
  const time = Date.parse(value);
  requireCondition(
    typeof value === "string" && Number.isFinite(time) && new Date(time).toISOString() === value,
    "Expected a UTC timestamp with milliseconds"
  );
  return time;
}

function checkFreshness(entry, issuedAt, now) {
  const observedAt = timestamp(entry.observedAt);
  const freshUntil = timestamp(entry.freshUntil);
  requireCondition(
    observedAt <= issuedAt && freshUntil > now && observedAt < freshUntil,
    "Recipe or source observation is outside its freshness window"
  );
}

function verifyRelease(root, trustedKey, expectedRevision, now = Date.now(), includeLayoutEvidence = false) {
  requireCondition(typeof expectedRevision === "string" && REVISION.test(expectedRevision), "Expected a full reviewed Git revision");
  requireCondition(Number.isFinite(now), "Expected a verification time");
  requireCondition(trustedKey.type === "public" && trustedKey.asymmetricKeyType === "ed25519", "Expected a trusted Ed25519 public key");
  requireCondition(fs.lstatSync(root).isDirectory(), "Release root must be an ordinary directory");
  const manifestBytes = readBundleFile(root, "release.json", MANIFEST_LIMIT);
  const signature = readBundleFile(root, "release.sig", 64);
  requireCondition(
    signature.length === 64 && crypto.verify(null, manifestBytes, trustedKey, signature),
    "Release signature is invalid"
  );
  const manifest = parseJSON(manifestBytes);
  requireCondition(
    manifestBytes.equals(Buffer.from(JSON.stringify(manifest, null, 2) + "\n")),
    "Release manifest must use the canonical JSON encoding"
  );
  checkFields(manifest, [
    "schemaVersion", "sourceRevision", "issuedAt", "expiresAt", "recipe", "sources",
    "renderManifestSha256", "transformations"
  ], "Release manifest");
  requireCondition(manifest.schemaVersion === 1, "Unsupported release manifest version");
  requireCondition(manifest.sourceRevision === expectedRevision, "Release source revision does not match");
  const issuedAt = timestamp(manifest.issuedAt);
  requireCondition(issuedAt <= now && now < timestamp(manifest.expiresAt), "Release is outside its validity window");
  requireCondition(
    Array.isArray(manifest.transformations) && manifest.transformations.length === TRANSFORMATIONS.length &&
      TRANSFORMATIONS.every((step, index) => step === manifest.transformations[index]),
    "Unsupported or misordered release transformation"
  );

  const recipe = manifest.recipe;
  checkFields(recipe, ["url", "redirectTarget", "sha256", "observedAt", "freshUntil"], "Recipe");
  requireCondition(isCanonicalHttps(recipe.url), "Recipe must use a canonical HTTPS URL");
  if (recipe.redirectTarget !== null) {
    requireCondition(
      isCanonicalHttps(recipe.redirectTarget) && recipe.redirectTarget !== recipe.url &&
        new URL(recipe.redirectTarget).origin === new URL(recipe.url).origin,
      "Recipe redirect must be a different URL on the same HTTPS origin"
    );
  }
  checkFreshness(recipe, issuedAt, now);

  requireCondition(Array.isArray(manifest.sources) && manifest.sources.length <= 16, "Invalid list of reviewed sources");
  const sourceNames = new Set();
  const sourceUrls = new Set();
  for (const source of manifest.sources) {
    checkFields(source, ["file", "url", "sha256", "observedAt", "freshUntil"], "Reviewed source");
    requireCondition(typeof source.file === "string" && SOURCE_FILE.test(source.file), "Invalid source snapshot path");
    requireCondition(isCanonicalHttps(source.url), "Source must use a canonical HTTPS URL");
    requireCondition(!sourceNames.has(source.file) && !sourceUrls.has(source.url), "Duplicate reviewed source");
    checkFreshness(source, issuedAt, now);
    sourceNames.add(source.file);
    sourceUrls.add(source.url);
  }
  checkInventory(root, sourceNames.size ? [...FIXED_FILES, "sources"] : FIXED_FILES);
  if (sourceNames.size) checkInventory(path.join(root, "sources"), [...sourceNames].map(name => path.basename(name)));
  for (const source of manifest.sources) {
    checkDigest(readBundleFile(root, source.file, TEXT_LIMIT), source.sha256, "Source snapshot");
  }
  checkDigest(readBundleFile(root, "card.md", TEXT_LIMIT), recipe.sha256, "Recipe snapshot");
  const recordedRender = readBundleFile(root, "card.manifest.json", MANIFEST_LIMIT);
  checkDigest(recordedRender, manifest.renderManifestSha256, "Render manifest");
  const configLabel = parseJSON(recordedRender)?.configuration?.file;
  requireCondition(
    typeof configLabel === "string" && /^(?:[a-z0-9._-]+\/)*[a-z0-9._-]+$/iu.test(configLabel) &&
      configLabel.length <= 256 && !configLabel.split("/").some(segment => segment === "." || segment === ".."),
    "Invalid render configuration provenance path"
  );
  const config = readBundleFile(root, "card.json", MAX_CONFIG_BYTES);
  const rendered = renderCard(config, configLabel);
  requireCondition(rendered.recipeUrl === recipe.url, "Card and release refer to different recipes");
  requireCondition(rendered.manifest.equals(recordedRender), "Render manifest did not reproduce");
  requireCondition(
    readBundleFile(root, "card.svg", TEXT_LIMIT).equals(Buffer.from(rendered.svg)) &&
      readBundleFile(root, "card.png", PNG_LIMIT).equals(rendered.png),
    "Release artifacts did not reproduce"
  );
  const receipt = { sourceRevision: expectedRevision, manifestSha256: sha256(manifestBytes) };
  if (includeLayoutEvidence) {
    receipt.layoutEvidence = {
      transformation: "layout-reconstruction",
      result: "byte-match",
      verifiedAt: new Date(now).toISOString(),
      renderManifestSha256: manifest.renderManifestSha256
    };
  }
  return receipt;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const [root, keyPath, expectedRevision, option] = args;
    const includeLayoutEvidence = option === "--layout-evidence";
    requireCondition(
      args.length === 3 || (args.length === 4 && includeLayoutEvidence),
      "Usage: node scripts/verify-release.js bundle-dir trusted-public-key.pem reviewed-git-sha [--layout-evidence]"
    );
    const key = crypto.createPublicKey(readLocalFile(keyPath, 4096));
    const result = verifyRelease(root, key, expectedRevision, Date.now(), includeLayoutEvidence);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error("Release verification failed:", error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyRelease };
