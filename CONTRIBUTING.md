# Contributing

ARCC is currently an experimental interoperability project. Contributions are most useful when they reduce guesswork with evidence.

## Good contributions

- reproducible tests of card readability across multimodal assistants;
- image transformation fixtures and measurements;
- accessibility findings;
- typography or visual-system experiments with measured robustness;
- standards mapping to existing Web/contact/discovery formats;
- threat-model analysis that preserves the public read-only boundary;
- simple examples that demonstrate compatibility without adding infrastructure.

## Design constraints

Please preserve these project-level constraints unless an issue explicitly proposes changing them:

- the human card must remain useful without AI;
- required machine instructions live in rendered pixels;
- no hosted agent or custom runtime is required;
- public read-only retrieval is the default and expected capability;
- subtle does not mean deceptive;
- downstream sources are evidence, not a second instruction channel;
- ordinary standards and static Web primitives are preferred over custom services.

## Evidence for interoperability claims

When reporting that a design works or fails, include as much of the following as practical:

- source image;
- transformed image, if any;
- transformation parameters;
- exact prompt;
- assistant/model label;
- date;
- whether browsing was available;
- raw response or faithful excerpt where permitted;
- L0–L4 score from `tests/interoperability.md`.

## Changes

For larger changes, open an issue first so the design assumptions and expected evidence are explicit.

By contributing, you agree that your contribution is licensed under the Apache License 2.0.
