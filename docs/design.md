# ARCC design notes

ARCC should look like an excellent contemporary calling card before anyone knows it is machine-readable.

The visual system has three jobs, in this order:

1. present a person's identity clearly to a human;
2. carry a durable agent bootstrap instruction;
3. leave the remaining visual space available for expressive design.

## The machine layer should be quiet, not hidden

The working reference treatment is **microprint as structure**.

A border, arc, rule, orbit, contour, or other line-like element can be composed from small text. At ordinary viewing size it behaves as graphic texture; when zoomed it becomes readable.

This is preferable to:

- metadata, which may be stripped;
- transparent text, which may disappear or appear deceptive;
- steganographic perturbations;
- one-pixel text that depends on exact raster preservation;
- QR codes as the primary agent channel.

The machine instruction should be intentionally discoverable.

## The arc

ARCC is pronounced **"arc."** The name supports a visual metaphor: a static card can resolve a profile that follows the arc of a career.

The reference design should explore an arc as the functional carrier of the bootstrap text. The same element can therefore serve as:

- brand motif;
- composition device;
- microprint channel;
- animation path in web contexts.

The metaphor should remain optional for third-party cards. ARCC is a compatibility pattern, not a mandatory visual brand.

## Source and portable artifact

Recommended production flow:

```text
editable vector/source
        |
        v
high-resolution canonical PNG
        |
        +--> website embed
        +--> direct image URL
        +--> save/share/copy
        +--> optional QR destination
```

The vector source may contain richer structure, but the PNG must contain everything required for agent resolution.

## Animation

Animation is an enhancement, not part of the portability contract.

A website may animate the card or its surrounding presentation, for example:

- slow movement along the arc;
- restrained parallax;
- graph/network activity;
- subtle transition between static and resolved states.

Copying or saving the card should yield a stable static canonical frame.

## Human information density

The card should avoid exposing URLs, QR codes, or machine affordances as dominant human-facing elements.

Human-visible content should normally be limited to identifying information such as:

- name;
- role or discipline;
- organization when appropriate;
- a small number of durable identity descriptors.

The richer profile belongs in the resolved recipe.

## Resolution and typography

The reference implementation should test several effective microprint sizes instead of choosing one by intuition.

Variables to measure include:

- raster dimensions;
- typeface and x-height;
- contrast;
- character spacing;
- text path curvature;
- bootstrap repetition;
- image compression;
- downscaling.

The design target is not the smallest possible text. It is the smallest treatment that is visually unobtrusive **and** robust across ordinary transformations.

## Accessibility

The human card should retain normal accessibility practices when embedded on the Web, including meaningful alt text in the surrounding page.

Alt text is not part of the ARCC machine contract because it does not survive image-only transfer.
