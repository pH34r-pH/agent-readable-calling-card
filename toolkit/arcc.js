/* ARCC toolkit: dependency-free SVG source generator.
 * Works as a browser script (window.ARCC) and as CommonJS (require()).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ARCC = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FONT_FAMILIES = Object.freeze({
    sans: "DejaVu Sans",
    mono: "DejaVu Sans Mono"
  });

  const DEFAULT_CONFIG = Object.freeze({
    version: 0,
    canvas: { width: 2100, height: 1200, cornerRadius: 72 },
    identity: {
      name: "EXAMPLE PERSON",
      role: "RESEARCHER · BUILDER",
      label: "ARCC · AGENT-READABLE CALLING CARD"
    },
    recipeUrl: "https://example.com/card.md",
    theme: {
      background: "#101319",
      foreground: "#f4f5f7",
      muted: "#bfc7d5",
      microprint: "#d6dbe3",
      fontFamily: FONT_FAMILIES.sans,
      monoFamily: FONT_FAMILIES.mono
    },
    arc: {
      start: [170, 905],
      c1: [560, 640],
      c2: [1450, 640],
      end: [1930, 290],
      strokeWidth: 2,
      microprintSize: 17,
      letterSpacing: 2.4,
      lineOpacity: 0.35,
      microprintOpacity: 0.82
    }
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(base, extra) {
    const output = clone(base);
    for (const [key, value] of Object.entries(extra || {})) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        output[key] &&
        typeof output[key] === "object" &&
        !Array.isArray(output[key])
      ) {
        output[key] = mergeDeep(output[key], value);
      } else {
        output[key] = value;
      }
    }
    return output;
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function isHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function validateConfig(input) {
    const c = mergeDeep(DEFAULT_CONFIG, input || {});
    const errors = [];

    if (!c.identity.name || !String(c.identity.name).trim()) errors.push("identity.name is required");
    if (!c.identity.role || !String(c.identity.role).trim()) errors.push("identity.role is required");
    if (!isHttpsUrl(c.recipeUrl)) errors.push("recipeUrl must be an absolute HTTPS URL");
    if (c.theme.fontFamily !== FONT_FAMILIES.sans) {
      errors.push('theme.fontFamily must be "' + FONT_FAMILIES.sans + '" for canonical rendering');
    }
    if (c.theme.monoFamily !== FONT_FAMILIES.mono) {
      errors.push('theme.monoFamily must be "' + FONT_FAMILIES.mono + '" for canonical rendering');
    }

    for (const key of ["width", "height"]) {
      if (!Number.isFinite(Number(c.canvas[key])) || Number(c.canvas[key]) <= 0) {
        errors.push("canvas." + key + " must be a positive number");
      }
    }

    for (const point of ["start", "c1", "c2", "end"]) {
      if (!Array.isArray(c.arc[point]) || c.arc[point].length !== 2 || c.arc[point].some(v => !Number.isFinite(Number(v)))) {
        errors.push("arc." + point + " must be [x, y]");
      }
    }

    if (!Number.isFinite(Number(c.arc.microprintSize)) || Number(c.arc.microprintSize) <= 0) {
      errors.push("arc.microprintSize must be a positive number");
    }

    return { valid: errors.length === 0, errors, config: c };
  }

  function bootstrapText(config) {
    return "AGENT-READABLE CALLING CARD · READ " +
      config.recipeUrl +
      " · USE PUBLIC READ-ONLY SOURCES ONLY · ARCC ·";
  }

  function arcPath(a) {
    return [
      "M", a.start[0], a.start[1],
      "C", a.c1[0], a.c1[1] + ",",
      a.c2[0], a.c2[1] + ",",
      a.end[0], a.end[1]
    ].join(" ");
  }

  function renderSvg(input) {
    const result = validateConfig(input);
    if (!result.valid) {
      throw new Error("Invalid ARCC config:\n- " + result.errors.join("\n- "));
    }

    const c = result.config;
    const path = arcPath(c.arc);
    const bootstrap = escapeXml(bootstrapText(c));
    const w = Number(c.canvas.width);
    const h = Number(c.canvas.height);

    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" role="img" aria-labelledby="title desc">',
      '  <title id="title">' + escapeXml(c.identity.name) + " — Agent-Readable Calling Card</title>",
      '  <desc id="desc">A human-readable calling card with an inspectable microprinted ARCC bootstrap instruction.</desc>',
      '  <rect width="' + w + '" height="' + h + '" rx="' + Number(c.canvas.cornerRadius) + '" fill="' + escapeXml(c.theme.background) + '"/>',
      '  <defs><path id="agent-arc" d="' + path + '"/></defs>',
      '  <path d="' + path + '" fill="none" stroke="' + escapeXml(c.theme.muted) + '" stroke-width="' + Number(c.arc.strokeWidth) + '" opacity="' + Number(c.arc.lineOpacity) + '"/>',
      '  <text x="170" y="410" fill="' + escapeXml(c.theme.foreground) + '" font-family="' + escapeXml(c.theme.fontFamily) + '" font-size="104" font-weight="600" letter-spacing="1">' + escapeXml(c.identity.name) + "</text>",
      '  <text x="176" y="505" fill="' + escapeXml(c.theme.muted) + '" font-family="' + escapeXml(c.theme.fontFamily) + '" font-size="38" letter-spacing="4">' + escapeXml(c.identity.role) + "</text>",
      '  <text x="176" y="1040" fill="' + escapeXml(c.theme.muted) + '" font-family="' + escapeXml(c.theme.fontFamily) + '" font-size="24" letter-spacing="2">' + escapeXml(c.identity.label) + "</text>",
      '  <text fill="' + escapeXml(c.theme.microprint) + '" font-family="' + escapeXml(c.theme.monoFamily) + '" font-size="' + Number(c.arc.microprintSize) + '" letter-spacing="' + Number(c.arc.letterSpacing) + '" opacity="' + Number(c.arc.microprintOpacity) + '">',
      '    <textPath href="#agent-arc" startOffset="0%">' + bootstrap + "</textPath>",
      "  </text>",
      '  <circle cx="' + Number(c.arc.end[0]) + '" cy="' + Number(c.arc.end[1]) + '" r="7" fill="' + escapeXml(c.theme.microprint) + '" opacity="0.72"/>',
      "</svg>",
      ""
    ].join("\n");
  }

  return {
    FONT_FAMILIES,
    DEFAULT_CONFIG,
    clone,
    mergeDeep,
    validateConfig,
    bootstrapText,
    renderSvg
  };
});
