#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ARCC = require("../toolkit/arcc.js");
const projectPackage = require("../package.json");
const projectLock = require("../package-lock.json");
const { Resvg } = require("@resvg/resvg-js");
const rendererPackage = require("@resvg/resvg-js/package.json");
const fontPackage = require("dejavu-fonts-ttf/package.json");
const { readLocalFile } = require("./read-local-file.js");
const rendererLock = projectLock.packages["node_modules/@resvg/resvg-js"];
const fontLock = projectLock.packages["node_modules/dejavu-fonts-ttf"];

const fontPackageRoot = path.dirname(require.resolve("dejavu-fonts-ttf/package.json"));
const fontRepository = typeof fontPackage.repository === "string"
  ? fontPackage.repository
  : fontPackage.repository.url;
const FONT_FILES = [
  { family: ARCC.FONT_FAMILIES.sans, style: "normal", weight: 400, file: "ttf/DejaVuSans.ttf" },
  { family: ARCC.FONT_FAMILIES.sans, style: "normal", weight: 700, file: "ttf/DejaVuSans-Bold.ttf" },
  { family: ARCC.FONT_FAMILIES.mono, style: "normal", weight: 400, file: "ttf/DejaVuSansMono.ttf" }
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function posixPath(value) {
  return value.split(path.sep).join("/");
}

function usage() {
  console.error("Usage: node scripts/render-card.js [config.json] [output-dir]");
}

function renderCard(raw, configLabel) {
  let config;
  try {
    config = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new Error("Input must contain a valid UTF-8 JSON configuration");
  }
  const validation = ARCC.validateConfig(config);
  if (!validation.valid) throw new Error("Invalid ARCC config: " + validation.errors.join("; "));

  const svg = ARCC.renderSvg(validation.config);

  const fontInputs = FONT_FILES.map(font => {
    const filePath = path.join(fontPackageRoot, font.file);
    const data = fs.readFileSync(filePath);
    return {
      ...font,
      absolutePath: filePath,
      sha256: sha256(data)
    };
  });

  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: ARCC.FONT_FAMILIES.sans,
      fontFiles: fontInputs.map(font => font.absolutePath)
    }
  });
  const png = renderer.render().asPng();
  const fontLicense = "Bitstream Vera and Arev Fonts licenses; DejaVu modifications are public domain. See the package LICENSE.";
  const manifest = {
    schemaVersion: 1,
    generator: {
      package: projectPackage.name,
      version: projectPackage.version
    },
    configuration: {
      file: configLabel,
      sha256: sha256(raw)
    },
    renderer: {
      package: "@resvg/resvg-js",
      version: rendererPackage.version,
      packageUrl: rendererLock.resolved,
      packageIntegrity: rendererLock.integrity,
      systemFontsLoaded: false
    },
    fonts: fontInputs.map(font => ({
      family: font.family,
      style: font.style,
      weight: font.weight,
      package: fontPackage.name,
      packageVersion: fontPackage.version,
      packageUrl: fontLock.resolved,
      packageIntegrity: fontLock.integrity,
      packageFile: font.file,
      source: fontRepository.startsWith("http")
        ? fontRepository
        : "https://github.com/" + fontRepository,
      license: fontLicense,
      packageLicenseDeclaration: fontPackage.license,
      licenseFile: "LICENSE",
      sha256: font.sha256
    })),
    outputs: {
      svg: { file: "card.svg", sha256: sha256(svg) },
      png: { file: "card.png", sha256: sha256(png) }
    }
  };
  return {
    recipeUrl: validation.config.recipeUrl,
    svg,
    png,
    manifest: Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8")
  };
}

if (require.main === module) {
  const configPath = process.argv[2] || "toolkit/card.example.json";
  const outputDir = process.argv[3] || "dist";
  try {
    const raw = readLocalFile(configPath, ARCC.MAX_CONFIG_BYTES);
    const configLabel = posixPath(path.relative(process.cwd(), path.resolve(configPath)));
    const { svg, png, manifest } = renderCard(raw, configLabel);
    fs.mkdirSync(outputDir, { recursive: true });
    for (const [filename, data] of Object.entries({
      "card.svg": svg, "card.png": png, "card.manifest.json": manifest
    })) {
      const target = path.join(outputDir, filename);
      fs.writeFileSync(target, data);
      console.log("wrote", target);
    }
  } catch (error) {
    usage();
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { renderCard, sha256 };
