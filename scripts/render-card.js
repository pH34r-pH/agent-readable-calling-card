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

const configPath = process.argv[2] || "toolkit/card.example.json";
const outputDir = process.argv[3] || "dist";

if (!fs.existsSync(configPath)) {
  usage();
  console.error("\nConfig not found:", configPath);
  process.exit(1);
}

const raw = fs.readFileSync(configPath, "utf8");
const config = JSON.parse(raw);
const validation = ARCC.validateConfig(config);

if (!validation.valid) {
  console.error("Invalid ARCC config:");
  for (const error of validation.errors) console.error("-", error);
  process.exit(1);
}

const svg = ARCC.renderSvg(validation.config);
fs.mkdirSync(outputDir, { recursive: true });

const svgPath = path.join(outputDir, "card.svg");
fs.writeFileSync(svgPath, svg, "utf8");
console.log("wrote", svgPath);

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
const pngPath = path.join(outputDir, "card.png");
fs.writeFileSync(pngPath, png);
console.log("wrote", pngPath);

const manifestPath = path.join(outputDir, "card.manifest.json");
const fontLicense = "Bitstream Vera and Arev Fonts licenses; DejaVu modifications are public domain. See the package LICENSE.";
const manifest = {
  schemaVersion: 1,
  generator: {
    package: projectPackage.name,
    version: projectPackage.version
  },
  configuration: {
    file: posixPath(path.relative(process.cwd(), path.resolve(configPath))),
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
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("wrote", manifestPath);
