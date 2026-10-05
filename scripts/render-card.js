#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ARCC = require("../toolkit/arcc.js");

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

try {
  const { Resvg } = require("@resvg/resvg-js");
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      loadSystemFonts: true
    }
  });
  const png = renderer.render().asPng();
  const pngPath = path.join(outputDir, "card.png");
  fs.writeFileSync(pngPath, png);
  console.log("wrote", pngPath);
} catch (error) {
  if (error && error.code === "MODULE_NOT_FOUND") {
    console.warn("PNG skipped: run npm install to install @resvg/resvg-js.");
  } else {
    throw error;
  }
}
