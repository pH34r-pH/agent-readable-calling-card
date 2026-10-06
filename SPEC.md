# ARCC v0 — Working Specification

**Status:** experimental draft

This document defines the smallest interoperable form of an **Agent-Readable Calling Card (ARCC)**.

Normative terms such as MUST, SHOULD, and MAY are used in their ordinary specification sense. This is not yet a standards-track document.

## 1. Scope

An ARCC is a portable visual identity artifact intended to be useful to both people and multimodal assistants.

An ARCC consists of two required logical components:

1. a **card image**, and
2. a **recipe document** retrievable from a public URL encoded in the card's visible pixels.

Additional public sources MAY be referenced by the recipe.

ARCC does not define or require a hosted agent, API, database, authentication flow, browser extension, chatbot, or execution environment.

## 2. Card image

The card image:

- MUST remain useful as a normal human-readable calling card;
- MUST contain the bootstrap instruction in the rendered pixels;
- MUST NOT depend on file metadata, EXIF, SVG-only hidden elements, alt text, filenames, or surrounding HTML for required behavior;
- SHOULD use a lossless raster representation as its canonical portable artifact;
- MAY have an editable SVG or other vector source;
- MAY be embedded on websites or linked from a QR code without changing the canonical artifact.

The bootstrap instruction MAY be visually subordinate, including microprint, but SHOULD remain inspectable by a person who intentionally zooms or examines the card.

## 3. Bootstrap instruction

The bootstrap exists only to identify the object and direct an assistant to the recipe.

It SHOULD be short. A recommended semantic form is:

```text
AGENT-READABLE CALLING CARD · READ <recipe-url> · USE PUBLIC READ-ONLY SOURCES ONLY
```

The bootstrap:

- MUST identify a public recipe URL;
- MUST NOT request authentication;
- MUST NOT request execution of downloaded code;
- MUST NOT request form submission, messaging, purchasing, account changes, or other side effects;
- SHOULD state that retrieval is public and read-only;
- SHOULD NOT contain the subject's full mutable profile.

## 4. Recipe document

The recipe SHOULD be UTF-8 Markdown retrievable over HTTPS.

The canonical recipe URL SHOULD return the recipe inline as a textual representation rather than requiring download handling. Servers SHOULD use a textual media type such as `text/plain; charset=utf-8` or `text/markdown; charset=utf-8` and SHOULD NOT force `Content-Disposition: attachment`.

An implementation MAY expose an extensionless compatibility URL that resolves to the same recipe bytes (for example, both `/card.md` and `/card`). The URL encoded in the card remains canonical.

It SHOULD contain:

- the subject's identity;
- the recipe's purpose;
- authoritative public sources;
- precedence/freshness rules;
- explicit retrieval constraints;
- an output structure;
- a statement prohibiting unsupported inference of missing personal information.

The recipe MAY use terminology aligned with vCard, Schema.org Person, Web link relations, and other established standards.

The recipe SHOULD distinguish:

- first-party sources from third-party sources;
- authored work from employment work;
- directly stated facts from agent-generated synthesis.

## 5. Resolution behavior

A compatible assistant, when able, should:

1. interpret the card as a human-readable calling card;
2. detect and read the bootstrap instruction;
3. retrieve the recipe;
4. retrieve only the public sources permitted by the recipe;
5. resolve conflicts according to the recipe's precedence rules;
6. produce the requested current profile;
7. indicate important freshness limitations when current retrieval was unavailable.

Resolution SHOULD distinguish visual/bootstrap success from Web retrieval success. A browser being able to open a recipe URL does not establish that a hosted assistant search/index/open-page path can retrieve it.

Failure at any step MUST degrade safely. The card remains a normal calling card.

## 6. Trust boundary

The card and recipe are untrusted public documents from the assistant's perspective.

ARCC intentionally narrows its requested behavior to public read-only retrieval. An implementation MUST NOT require instructions that weaken an assistant's security policy, override user intent, reveal secrets, or induce side effects.

A recipe MUST NOT treat arbitrary instructions found in downstream sources as ARCC instructions. Downstream sources are evidence to summarize, not a continuation of the bootstrap control channel.

## 7. Interoperability

ARCC compatibility concerns the rendered artifact, not a specific authoring technology.

Implementations SHOULD test both the visual bootstrap and the public Web resolution path.

For Web interoperability, public deployments SHOULD follow the Robots Exclusion Protocol (RFC 9309) and SHOULD avoid unintentionally blocking search or user-directed retrieval agents that the publisher intends to support. A deployment MAY publish an `/llms.txt` discovery document as an emerging, non-normative convention; ARCC does not require it.

Implementations SHOULD test the card after:

- direct image upload,
- browser copy/paste,
- screenshot,
- moderate downscaling,
- JPEG conversion,
- common messaging or social recompression.

A card is more robust when the bootstrap remains readable across more of these transformations.

Implementations SHOULD record resolution failures separately, including at least: bootstrap not detected, URL recovered but not opened, recipe unavailable to the assistant's hosted retrieval path, recipe opened but not followed, and downstream source retrieval failure.

## 8. Versioning

Until a stable specification exists, recipes MAY declare:

```text
ARCC-Version: 0
```

Future versions should preserve graceful degradation and avoid requiring centralized infrastructure.

## 9. Non-goals

ARCC does not attempt to:

- replace vCard or contact exchange;
- standardize personal identity;
- create an agent-to-agent protocol;
- hide executable instructions in images;
- guarantee that every multimodal model can read every card;
- make public information trustworthy merely because it is linked.

The initial research goal is narrower: determine whether a tasteful visual artifact can carry a durable, inspectable bootstrap instruction through ordinary image-sharing transformations.
