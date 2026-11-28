#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const { isHttpsUrl } = require("../toolkit/arcc.js");
const { readLocalFile } = require("./read-local-file.js");
const {
  verifyRelease, checkDigest, checkReleaseEvidence, parseCanonicalJSON, readBundleFile,
  requireCondition, MANIFEST_LIMIT, PNG_LIMIT
} = require("./verify-release.js");

async function verifyWebCard(root, key, revision, manifestSha, cardUrl, {
  request = fetch, clock = Date.now
} = {}) {
  const verified = verifyRelease(root, key, revision, clock());
  requireCondition(verified.manifestSha256 === manifestSha, "Release does not match the approved manifest digest");
  requireCondition(isHttpsUrl(cardUrl) && new URL(cardUrl).href === cardUrl, "Card must use an approved canonical HTTPS URL");
  const manifestBytes = readBundleFile(root, "release.json", MANIFEST_LIMIT);
  checkDigest(manifestBytes, manifestSha, "Verified release manifest");
  const manifest = parseCanonicalJSON(manifestBytes, "Release manifest");
  const renderBytes = readBundleFile(root, "card.manifest.json", MANIFEST_LIMIT);
  checkDigest(renderBytes, manifest.renderManifestSha256, "Render manifest");
  const imageSha = JSON.parse(renderBytes.toString("utf8"))?.outputs?.png?.sha256;
  requireCondition(typeof imageSha === "string" && /^[0-9a-f]{64}$/u.test(imageSha), "Invalid rendered image digest");

  const response = await request(cardUrl, {
    method: "GET", redirect: "manual", credentials: "omit", cache: "no-store",
    signal: AbortSignal.timeout(15_000), headers: { Accept: "image/png" }
  });
  try {
    requireCondition(response.status === 200, "Card must return HTTP 200 without redirect");
    requireCondition((response.headers.get("content-type") || "").trim().toLowerCase() === "image/png",
      "Card must return image/png");
    requireCondition(response.body !== null, "Card response has no body");
    const hash = crypto.createHash("sha256");
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      requireCondition(size <= PNG_LIMIT, "Card response exceeds its size limit");
      hash.update(chunk);
    }
    requireCondition(hash.digest("hex") === imageSha, "Live card digest does not match");
    const checkedAt = clock();
    checkReleaseEvidence(manifest, revision, checkedAt);
    return { ...verified, cardEvidence: { cardUrl, checkedAt: new Date(checkedAt).toISOString(),
      status: 200, mediaType: "image/png", bytes: size, sha256: imageSha } };
  } finally {
    if (response.body && !response.bodyUsed) await response.body.cancel();
  }
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    requireCondition(args.length === 5,
      "Usage: node scripts/verify-web-card.js bundle-dir trusted-key.pem reviewed-git-sha approved-manifest-sha256 approved-card-url");
    const [root, keyPath, revision, manifestSha, cardUrl] = args;
    const key = crypto.createPublicKey(readLocalFile(keyPath, 4096));
    console.log(JSON.stringify(await verifyWebCard(root, key, revision, manifestSha, cardUrl)));
  })().catch(error => {
    console.error("Web card verification failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { verifyWebCard };
