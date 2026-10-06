# ARCC toolkit

The toolkit turns ARCC into a small software-defined design environment.

It has two entry points:

- **Studio:** a zero-build browser editor for people who do not want to write code.
- **Agent Skill:** a portable workflow that teaches a coding agent how to design and refine ARCC graphics through rendered evidence.

Both work on the same underlying representation: structured configuration plus ordinary SVG.

## Open the studio

Open `toolkit/studio/index.html` in a modern browser.

No install, account, API key, or local server is required.

The studio lets you:

- edit name, role, and recipe URL;
- choose colors;
- tune the microprint size and spacing;
- tune the arc geometry;
- import/export reusable JSON configuration;
- download the editable SVG;
- download a convenience PNG render.

The browser preview resolves the named families through the browser and any fonts installed on that machine, so its appearance can differ slightly. The browser PNG is for convenience. For reproducible canonical output, use the CLI renderer; it uses the pinned package fonts and does not inspect local system fonts.

## Canonical rendering

With Node.js installed:

```sh
npm ci
npm test
npm run render
```

This renders `toolkit/card.example.json` into `dist/card.svg`, `dist/card.png`, and `dist/card.manifest.json`. The canonical PNG uses the pinned DejaVu Sans and DejaVu Sans Mono TrueType files from `dejavu-fonts-ttf@2.37.3`. The renderer passes only those files to `resvg-js` and disables system-font loading. The manifest records the renderer version, font package and license provenance, per-file font hashes, configuration hash, and output hashes.

Render another config:

```sh
node scripts/render-card.js path/to/card.json dist
```

PNG output uses `@resvg/resvg-js`. The font package contains the DejaVu font files and their license. The DejaVu fonts are based on Bitstream Vera; the package includes the Bitstream Vera and Arev license notices, with DejaVu changes in the public domain. No font binaries are copied into this repository.

## Design with an agent

The repository includes `skills/arcc-designer/SKILL.md`, following the open Agent Skills format.

A compatible coding agent can use that skill to:

1. understand the current card and requested change;
2. edit configuration and/or SVG construction;
3. render the result;
4. visually inspect it;
5. critique the actual render;
6. revise and repeat.

The skill treats the ARCC bootstrap as a protocol layer that must survive artistic changes.

## Why configuration *and* SVG?

Configuration gives nontechnical users a stable surface for common changes. SVG remains available as the escape hatch for art direction.

An agent may extend the renderer with gradients, geometry, patterns, masks, or illustration while retaining:

- the human-readable identity hierarchy;
- the inspectable machine bootstrap;
- a stable recipe URL;
- a static canonical image.

The goal is not to force all cards into one template. It is to give every card a reproducible source of truth.
