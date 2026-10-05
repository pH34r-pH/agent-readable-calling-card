# ARCC — Agent-Readable Calling Card

**A calling card that follows the arc of your career.**

ARCC is an open pattern for business cards that work at two scales:

1. **Human-readable:** a visually designed calling card with ordinary identifying information.
2. **Agent-readable:** subtle, visible-in-the-pixels instructions tell a multimodal assistant where to find a static profile recipe.
3. **Static by design:** the card and recipe are ordinary public files. ARCC requires no app, API, account, chatbot, MCP server, or hosted agent.

A person can save, share, embed, screenshot, or paste the card into the AI assistant they already use. When the assistant can read the embedded bootstrap instruction and browse the web, it can retrieve the recipe and assemble a current profile from declared public sources.

> The image stays stable. The public profile it resolves can change with the arc of a career.

## Why a calling card?

Traditional calling cards were portable identity artifacts: something small enough to leave behind, useful without infrastructure, and meaningful before any further conversation happened. ARCC keeps that property while adding an agent-readable layer.

ARCC is intentionally **not** an A2A Agent Card and does not advertise a remote agent endpoint. The recipient's existing assistant is the renderer.

## Core design

```text
human sees card
     |
     v
+--------------------------+
| canonical image          |
|                          |
| name / role / identity   |
| visual design            |
| microprint bootstrap     |
+------------+-------------+
             |
             | agent reads visible instruction
             v
       public card.md
             |
             | declares sources + rules + output shape
             v
   ordinary public endpoints
             |
             v
      current profile
```

The canonical portable artifact SHOULD be a lossless raster image such as PNG. SVG is useful as an editable source, but metadata or invisible SVG-only content MUST NOT be required for interoperability.

## Make a card

ARCC includes a small **software-defined design toolkit** rather than requiring a particular design application.

### No-code / local-first

Open [`toolkit/studio/index.html`](toolkit/studio/index.html) in a modern browser.

The Studio requires no account, API key, build step, or hosted service. It provides a live card preview and lets you edit:

- name and role;
- public recipe URL;
- palette;
- microprint size and spacing;
- arc treatment.

It can export reusable JSON configuration, editable SVG, and a convenience PNG.

### Reproducible canonical render

With Node.js installed:

```sh
npm install
npm run render
```

The reference renderer uses SVG as the source of truth and `resvg-js` for the canonical PNG path.

### Design with an AI agent

The repo also ships [`skills/arcc-designer/SKILL.md`](skills/arcc-designer/SKILL.md), following the open Agent Skills format.

Compatible coding agents are instructed to work as a designer-engineer:

```text
direction
   ↓
edit SVG/config
   ↓
render
   ↓
inspect actual output
   ↓
critique
   ↓
revise
```

The starter renderer is intentionally plain. It is **not** a mandatory ARCC visual template. Agents and designers may substantially change the visual construction as long as the ARCC protocol layer remains intact.

The software-defined-art research and rationale are in [`research/software-defined-art.md`](research/software-defined-art.md).

## Repository layout

```text
README.md
SPEC.md
docs/
  design.md
research/
  software-defined-art.md
templates/
  card.md
examples/
  minimal/
    card.svg
    card.md
toolkit/
  arcc.js
  card.example.json
  studio/
    index.html
skills/
  arcc-designer/
    SKILL.md
scripts/
  render-card.js
tests/
  interoperability.md
  toolkit.test.js
```

## Minimal bootstrap

An ARCC card carries a short instruction in visible pixels. It may be microprinted into a border or other graphic element, but it should remain inspectable when zoomed.

A minimal bootstrap can be as small as:

```text
AGENT-READABLE CALLING CARD · READ https://example.com/card.md · USE PUBLIC READ-ONLY SOURCES ONLY
```

The bootstrap is **not** a hidden prompt. ARCC favors subtle-but-inspectable typography over steganography, metadata, transparent text, or adversarial prompt-injection techniques.

## The recipe

The hosted recipe is a static Markdown document. It identifies the subject, lists authoritative public sources, gives retrieval constraints, and defines how an assistant should present the resulting profile.

See [`templates/card.md`](templates/card.md).

## Design principles

- **Useful without AI.** The card should still be an excellent human business card.
- **Pixels are the contract.** Required machine instructions survive metadata loss.
- **No running service.** Hosting static files is enough.
- **Read-only retrieval.** A card must not ask an assistant to authenticate, submit forms, execute code, or perform side effects.
- **Inspectable instructions.** Machine-readable text may be visually quiet, but should not be deceptive.
- **First-party sources first.** Recipes should prefer authoritative public sources and distinguish facts from inference.
- **Freshness is resolved, not embedded.** Current information belongs at public sources, not permanently in the card image.
- **Graceful failure.** If an assistant cannot browse or cannot read the bootstrap, the card remains a normal calling card.
- **Standards before invention.** Where practical, ARCC should align with existing identity and Web standards rather than define competing semantics.
- **Source before pixels.** Visual changes should remain reproducible in editable SVG/code rather than becoming one-off raster generations.
- **Look before declaring success.** Agent-authored visual changes should be rendered and inspected before they are considered complete.

More detail is in [`SPEC.md`](SPEC.md) and [`docs/design.md`](docs/design.md).

## Interoperability target

A successful ARCC implementation should continue to work, as far as practical, after common transformations:

- original image upload,
- browser copy/paste,
- screenshot,
- downscaling,
- messaging-app recompression,
- JPEG conversion.

The initial test plan is documented in [`tests/interoperability.md`](tests/interoperability.md).

## Status

**Experimental / pre-specification.** ARCC now includes a reference authoring toolkit, but both the visual design and interoperability profile remain research targets. The design may change substantially as we collect evidence from current multimodal assistants and real image-sharing pipelines.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
