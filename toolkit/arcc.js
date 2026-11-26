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
  const MAX_CONFIG_BYTES = 32 * 1024;
  const MAX_CANVAS_DIMENSION = 4096;

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

  function isRecord(value) {
    return value !== null && typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype;
  }

  function mergeDeep(base, extra = {}, parent = "", errors = []) {
    const output = clone(base);
    if (!isRecord(extra)) {
      errors.push((parent || "config") + " must be a JSON object");
      return output;
    }
    for (const key of Object.keys(base)) {
      if (!Object.hasOwn(extra, key)) continue;
      const value = extra[key];
      if (isRecord(base[key])) {
        const field = parent ? parent + "." + key : key;
        output[key] = mergeDeep(base[key], value, field, errors);
      } else {
        output[key] = value;
      }
    }
    if (Object.keys(extra).some(key => !Object.hasOwn(base, key))) {
      errors.push((parent || "config") + " contains an unsupported field");
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
    if (typeof value !== "string" || value.length > 2048 ||
        !/^https:\/\/[^/\s\\\u0000-\u001f\u007f][^\s\\\u0000-\u001f\u007f]*$/u.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && Boolean(url.hostname) &&
        !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  }

  function numberInRange(value, minimum, maximum) {
    return typeof value === "number" && Number.isFinite(value) &&
      value >= minimum && value <= maximum;
  }

  function validateConfig(input) {
    const errors = [];
    const c = mergeDeep(DEFAULT_CONFIG, input, "", errors);

    if (c.version !== 0) errors.push("version must be 0");
    for (const key of ["name", "role", "label"]) {
      const value = c.identity[key];
      if (typeof value !== "string" || (key !== "label" && !value.trim()) ||
          value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) {
        errors.push("identity." + key + " must be bounded, single-line text");
      }
    }
    if (!isHttpsUrl(c.recipeUrl)) errors.push("recipeUrl must be an absolute HTTPS URL");
    if (c.theme.fontFamily !== FONT_FAMILIES.sans) {
      errors.push('theme.fontFamily must be "' + FONT_FAMILIES.sans + '" for canonical rendering');
    }
    if (c.theme.monoFamily !== FONT_FAMILIES.mono) {
      errors.push('theme.monoFamily must be "' + FONT_FAMILIES.mono + '" for canonical rendering');
    }

    for (const key of ["background", "foreground", "muted", "microprint"]) {
      const color = c.theme[key];
      if (typeof color !== "string" || !/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.test(color)) {
        errors.push("theme." + key + " must be a hexadecimal color");
      }
    }
    for (const key of ["width", "height"]) {
      const minimum = DEFAULT_CONFIG.canvas[key];
      if (!Number.isInteger(c.canvas[key]) || !numberInRange(c.canvas[key], minimum, MAX_CANVAS_DIMENSION)) {
        errors.push("canvas." + key + " must be an integer between " + minimum + " and " + MAX_CANVAS_DIMENSION);
      }
    }
    const width = numberInRange(c.canvas.width, DEFAULT_CONFIG.canvas.width, MAX_CANVAS_DIMENSION)
      ? c.canvas.width : DEFAULT_CONFIG.canvas.width;
    const height = numberInRange(c.canvas.height, DEFAULT_CONFIG.canvas.height, MAX_CANVAS_DIMENSION)
      ? c.canvas.height : DEFAULT_CONFIG.canvas.height;
    if (!numberInRange(c.canvas.cornerRadius, 0, Math.min(width, height) / 2)) {
      errors.push("canvas.cornerRadius is out of range");
    }
    for (const point of ["start", "c1", "c2", "end"]) {
      const value = c.arc[point];
      if (!Array.isArray(value) || value.length !== 2 ||
          !numberInRange(value[0], 0, width) || !numberInRange(value[1], 0, height)) {
        errors.push("arc." + point + " must contain two numeric coordinates inside the canvas");
      }
    }
    const ranges = {
      microprintSize: [1, 256], strokeWidth: [0, 256], letterSpacing: [-64, 256],
      lineOpacity: [0, 1], microprintOpacity: [0, 1]
    };
    for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
      if (!numberInRange(c.arc[key], minimum, maximum)) errors.push("arc." + key + " is out of range");
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
    MAX_CONFIG_BYTES,
    DEFAULT_CONFIG,
    clone,
    mergeDeep,
    isHttpsUrl,
    validateConfig,
    bootstrapText,
    renderSvg
  };
});
