# Software-defined art for ARCC

ARCC needs graphics that are expressive enough to feel designed, precise enough to carry microprinted machine instructions, and reproducible enough that a user or agent can make a small change without regenerating an unrelated image.

The current design decision is therefore **software-defined vector art**: the editable source is a graphics program / structured SVG document, the canonical portable artifact is a high-resolution PNG, and agents work through a render-review-revise loop.

## Why this direction

Recent work increasingly treats visual generation as a code-generation and editing problem rather than a one-shot raster-generation problem.

### VectorGym

ServiceNow's VectorGym (2026) benchmarks text-to-SVG, sketch-to-SVG, complex SVG editing, and SVG understanding. The inclusion of editing is important for ARCC: professional design work is iterative, and a useful representation has to support precise local changes rather than just prompt-level rerolls.

- https://arxiv.org/abs/2603.29852
- https://www.servicenow.com/research/publication/juan-a.-rodriguez-vect-emnlp2026.html

### StarVector, SVGen, and Chat2SVG

StarVector and SVGen both operate directly in SVG code space. Chat2SVG combines an LLM-authored structured SVG template with later visual refinement. Together they provide evidence that SVG is a useful semantic representation for generated graphics, not merely an export format.

- https://openaccess.thecvf.com/content/CVPR2025/html/Rodriguez_StarVector_Generating_Scalable_Vector_Graphics_Code_from_Images_and_Text_CVPR_2025_paper.html
- https://arxiv.org/abs/2508.09168
- https://openaccess.thecvf.com/content/CVPR2025/papers/Wu_Chat2SVG_Vector_Graphics_Generation_with_Large_Language_Models_and_Image_CVPR_2025_paper.pdf

### DesignCode

DesignCode is the closest current general-purpose product pattern. It gives an agent HTML/CSS/SVG as the design medium, provides a live preview, retains editability and version history, and exports SVG/PNG/PDF/PSD. This is very close to the desired authoring philosophy, but the complete desktop workbench and model runtime are heavier than ARCC needs.

- https://github.com/Haruhiyuki/DesignCode
- https://designcode.cc/en/

### Agentic creative-code loops

Several current projects independently converge on a render-feedback loop:

- ALIGN has coding agents write p5.js, render it, visually review it, and iteratively repair the program.
- p5js.ai exposes "describe it; AI writes the code" as a browser creative-coding workflow.
- SVG Creator Skill applies the same write SVG -> render -> inspect -> fix loop to vector illustration.
- design-loop generalizes the evidence-based inspect/revise loop to browser-rendered design.
- Anthropic's algorithmic-art skill emphasizes seeded generation for reproducibility.

References:

- https://github.com/wanshuiyin/ALIGN-Agentic-Loop-Image-GeneratioN
- https://p5js.ai/
- https://github.com/upbrew-tech/svg-creator-skill
- https://github.com/rithvikx/design-loop
- https://github.com/anthropics/skills/tree/main/skills/algorithmic-art

### Structured visual editors

tldraw's agent starter kit demonstrates a related pattern: an agent receives both screenshot context and structured shape state, then edits the structured canvas through typed actions. VibeSVG similarly explores an agent-native SVG editor.

These are useful references for future direct-manipulation tooling, but ARCC does not need an infinite-canvas application in its first iteration.

- https://tldraw.dev/starter-kits/agent
- https://github.com/KobayashiRui/vibe-svg-editor

## Representation comparison

| Medium | Strengths | Weaknesses | ARCC role |
| --- | --- | --- | --- |
| Raster generation | High visual richness, easy ideation | Weak local editability, unstable text, hard to reproduce | Mood/reference only |
| p5.js / Canvas | Excellent procedural art and animation, seeded randomness | Raster-first; typography and print geometry are less natural | Optional web animation / experimental backgrounds |
| HTML/CSS | Familiar to agents; strong typography/layout | Browser rendering differences; curved microprint is awkward | Optional authoring surface |
| tldraw-style scene graph | Excellent direct manipulation | Heavy editor/runtime for a small static artifact | Possible future editor |
| **SVG** | Text paths, exact geometry, structured diffs, browser-native, print-friendly, animatable | Raw coordinates can become verbose | **Canonical editable medium** |

## Renderer choice

The reference CLI uses **resvg-js** for SVG-to-PNG output.

The underlying resvg project explicitly targets reproducible rendering without system rendering-library dependence, and resvg-js packages it for Node. This fits ARCC's need for stable canonical raster artifacts.

- https://docs.rs/crate/resvg/latest/source/README.md
- https://www.npmjs.com/package/@resvg/resvg-js

The browser studio also provides a convenience PNG export using the browser's SVG renderer. That export is useful for casual users; the CLI/CI render is the canonical reproducible path.

## Toolkit architecture

```text
                       plain-language direction
                                 |
                  +--------------+--------------+
                  |                             |
             human studio                    AI agent
          (zero-build browser)          (Agent Skill workflow)
                  |                             |
                  +-------------+---------------+
                                |
                         card config + SVG
                                |
                  +-------------+---------------+
                  |                             |
             browser preview                resvg-js
                  |                             |
          convenience SVG/PNG             canonical PNG
```

The system intentionally has no custom graphics engine. SVG is the graphics language.

## Design source of truth

A card has two editable layers:

1. **configuration** — identity, recipe URL, palette, dimensions, arc geometry, microprint settings;
2. **SVG program** — the actual visual construction.

The basic studio edits configuration. An agent may also alter the SVG renderer to add richer geometry, patterns, gradients, masks, illustration, or motion, while preserving the ARCC protocol layer.

## Agent workflow

ARCC's design skill should require:

1. read the current card/config and design intent;
2. make one coherent visual change;
3. render;
4. inspect the actual output;
5. critique hierarchy, spacing, typography, contrast, and bootstrap legibility;
6. revise;
7. repeat until the requested design change is visibly satisfied;
8. retain the editable source and regenerate outputs.

A successful agent must never report a visual change as complete without looking at a rendered result when a rendering/vision tool is available.

## Nontechnical workflow

The first studio is deliberately a single static page:

1. open the studio;
2. type a name, role, and recipe URL;
3. adjust palette and arc treatment;
4. see the card update immediately;
5. export SVG, PNG, or the reusable JSON configuration.

No account, API key, build step, or hosted service is needed.

A later hosted copy can be published with GitHub Pages while retaining the exact same local-first behavior.

## Next research

- measure browser PNG export vs resvg output;
- add microprint legibility linting;
- evaluate font determinism and safe font packaging;
- add multiple design archetypes without turning them into rigid templates;
- experiment with p5.js/Canvas only for enhancement layers that collapse to a static canonical SVG/PNG;
- add visual regression and agent critique fixtures;
- investigate whether the studio should eventually expose direct manipulation or remain parameter-first.
