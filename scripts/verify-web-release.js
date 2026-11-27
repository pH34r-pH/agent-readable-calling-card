#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const { readLocalFile } = require("./read-local-file.js");
const {
  verifyRelease, checkDigest, checkReleaseEvidence, parseCanonicalJSON, readBundleFile,
  requireCondition, MANIFEST_LIMIT, TEXT_LIMIT
} = require("./verify-release.js");

const REDIRECTS = [301, 302, 303, 307, 308];
const REQUEST_TIMEOUT_MS = 15_000;

function singleHeader(value) {
  return !value.replace(/"(?:\\.|[^"\\])*"/gu, "").includes(",");
}

function recipeHeaders(response) {
  requireCondition(response.status === 200, "Recipe must return HTTP 200");
  const type = response.headers.get("content-type") || "";
  requireCondition(singleHeader(type), "Recipe must return inline text");
  const [mediaType, ...parameters] = type.toLowerCase()
    .split(";").map(value => value.trim());
  requireCondition(["text/plain", "text/markdown"].includes(mediaType), "Recipe must return inline text");
  for (const parameter of parameters) {
    if (/^charset\s*(?:=|$)/u.test(parameter)) {
      requireCondition(/^charset\s*=\s*(?:utf-8|"utf-8")$/u.test(parameter), "Recipe must use UTF-8");
    }
  }
  const disposition = response.headers.get("content-disposition");
  requireCondition(
    disposition === null || (singleHeader(disposition) && disposition.split(";", 1)[0].trim().toLowerCase() === "inline"),
    "Recipe must not require a download"
  );
  return { mediaType, contentDisposition: disposition === null ? null : "inline" };
}

async function readRecipe(response, expectedSha) {
  try {
    const headers = recipeHeaders(response);
    requireCondition(response.body !== null, "Recipe response has no body");
    const chunks = [];
    let size = 0;
    for await (const bytes of response.body) {
      size += bytes.byteLength;
      requireCondition(size <= TEXT_LIMIT, "Recipe response exceeds its size limit");
      chunks.push(bytes);
    }
    const recipe = Buffer.concat(chunks, size);
    checkDigest(recipe, expectedSha, "Live recipe");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(recipe);
    } catch {
      throw new Error("Recipe response is not valid UTF-8");
    }
    return { ...headers, bytes: size };
  } finally {
    if (response.body && !response.bodyUsed) await response.body.cancel();
  }
}

async function verifyWebRelease(root, key, revision, manifestSha, origin, {
  request = fetch, clock = Date.now
} = {}) {
  const verified = verifyRelease(root, key, revision, clock());
  requireCondition(verified.manifestSha256 === manifestSha, "Release does not match the approved manifest digest");
  const manifestBytes = readBundleFile(root, "release.json", MANIFEST_LIMIT);
  checkDigest(manifestBytes, manifestSha, "Verified release manifest");
  const manifest = parseCanonicalJSON(manifestBytes, "Release manifest");
  const recipe = manifest.recipe;
  requireCondition(new URL(recipe.url).origin === origin, "Recipe is outside the approved deployment origin");

  const options = {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: "text/markdown, text/plain" }
  };
  const canonical = await request(recipe.url, options);
  let response = canonical;
  let redirectStatus = null;
  if (recipe.redirectTarget !== null) {
    if (canonical.body) await canonical.body.cancel();
    const location = canonical.headers.get("location");
    requireCondition(
      REDIRECTS.includes(canonical.status) && location !== null &&
        new URL(location, recipe.url).href === recipe.redirectTarget,
      "Observed redirect does not match the approved recipe destination"
    );
    redirectStatus = canonical.status;
    response = await request(recipe.redirectTarget, options);
  }
  const content = await readRecipe(response, recipe.sha256);
  const checkedAt = clock();
  checkReleaseEvidence(manifest, revision, checkedAt);
  return {
    ...verified,
    webEvidence: {
      transformation: "web-resolution",
      result: "byte-match",
      checkedAt: new Date(checkedAt).toISOString(),
      recipeUrl: recipe.url,
      redirectTarget: recipe.redirectTarget,
      redirectStatus,
      status: response.status,
      recipeSha256: recipe.sha256,
      ...content
    }
  };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    requireCondition(args.length === 5,
      "Usage: node scripts/verify-web-release.js bundle-dir trusted-key.pem reviewed-git-sha approved-manifest-sha256 approved-https-origin");
    const [root, keyPath, revision, manifestSha, origin] = args;
    const key = crypto.createPublicKey(readLocalFile(keyPath, 4096));
    console.log(JSON.stringify(await verifyWebRelease(root, key, revision, manifestSha, origin)));
  })().catch(error => {
    console.error("Web release verification failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { verifyWebRelease };
