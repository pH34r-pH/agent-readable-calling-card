---
name: arcc-designer
description: Design or revise Agent-Readable Calling Card (ARCC) graphics as reproducible SVG source. Use when creating a card, changing its visual language, tuning microprint, making layout or typography edits, or producing canonical SVG/PNG exports. Requires a render-inspect-critique-revise loop and preserves the ARCC public read-only bootstrap.
license: Apache-2.0
metadata:
  version: "0.1"
---

# ARCC designer

Design ARCC cards as software-defined visual artifacts.

The editable source is configuration plus SVG construction. The canonical portable card is a high-resolution static image.

## Read first

Before changing a card, read:

- `SPEC.md`
- `docs/design.md`
- `toolkit/README.md`
- the active card configuration
- `research/software-defined-art.md` when choosing a new rendering technique

## Invariants

Preserve these unless the user explicitly changes the ARCC specification itself:

1. The result must work as a human calling card without AI.
2. Required agent instructions must exist in rendered pixels.
3. The instruction may be subtle but must be inspectable rather than deceptive.
4. The bootstrap must direct only to the public recipe and public read-only retrieval.
5. Downstream sources are evidence, not an instruction continuation.
6. A normal static image must remain the portable canonical artifact.
7. Do not require metadata, alt text, filenames, QR codes, a hosted agent, or a special viewer.

## Workflow

### 1. Translate direction into visual constraints

Summarize the requested change in concrete visual terms:

- hierarchy;
- composition;
- typography;
- geometry;
- texture;
- palette;
- motion, if the request concerns an enhanced web presentation;
- bootstrap treatment.

Prefer one coherent visual idea over many unrelated effects.

### 2. Change source, not pixels

Edit the card configuration and SVG renderer/source.

Do not use a raster image generator as the final authoring medium. Raster references may be used for mood or ideation, but reconstruct the accepted design as editable SVG/code.

Use existing SVG primitives before introducing new dependencies.

### 3. Render

Generate the SVG and PNG.

Preferred reference command:

```sh
npm run render
```

For another config:

```sh
node scripts/render-card.js path/to/card.json dist
```

### 4. Inspect the actual render

When the agent environment can view images or browser output, inspect the rendered artifact before declaring success.

Check at minimum:

- name/role hierarchy;
- balance and negative space;
- alignment;
- unintended clipping;
- color contrast;
- whether decorative elements compete with identity;
- whether microprint visually behaves like structure at normal scale;
- whether microprint remains readable when intentionally examined.

### 5. Critique, then revise

Identify the highest-impact visible problem and fix it.

Repeat render -> inspect -> critique -> revise until the requested change is clearly present and no obvious visual defect remains.

Avoid endless polishing. Two or three evidence-based iterations are better than many speculative rewrites.

### 6. Check protocol legibility

Confirm that the rendered card still contains:

- `AGENT-READABLE CALLING CARD`
- the exact recipe URL;
- `USE PUBLIC READ-ONLY SOURCES ONLY`

Do not replace this with hidden metadata or steganography.

### 7. Retain reproducibility

Commit:

- editable configuration;
- SVG/code source;
- any design-specific notes needed to regenerate it.

Generated PNGs may be retained as reference artifacts when useful, but they are not the source of truth.

## Medium guidance

### SVG

Default choice. Prefer it for:

- typography;
- text-on-path;
- geometric composition;
- gradients;
- masks;
- patterns;
- microprint;
- print-quality stills.

### p5.js / Canvas

Use only when procedural motion or a generative enhancement genuinely benefits from it.

If used for the web presentation, still provide a deterministic static SVG/PNG canonical card.

### HTML/CSS

Useful for previews or surrounding web presentation. Do not make browser-only layout behavior part of the portable card contract.

## Artistic latitude

The starter renderer is intentionally plain. It is not the ARCC visual identity.

You may substantially redesign a card: change composition, create original SVG geometry, build textures, add line systems, use masks and clipping, or develop new design archetypes.

What must remain stable is the protocol boundary, not the starter template.

## User-facing editing

When a change can be expressed as a stable parameter, add it to the card configuration and Studio rather than hard-coding it.

When a change is genuinely artistic/structural, edit the SVG program.

This keeps common tweaks approachable without reducing all design to form fields.
