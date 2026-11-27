# Verified ARCC release bundles

Keep each card release in a dedicated staging directory. Use a clean checkout of the
reviewed Git revision, the locked Node dependencies, and the existing canonical
renderer. Stage the reviewed configuration as `card.json` and the exact recipe bytes
as `card.md`. The renderer produces `card.svg`, `card.png`, and `card.manifest.json`.
Render from the reviewed checkout so the manifest records a relative configuration
path. Copy the same configuration bytes into the release bundle.

When a recipe cites sources reviewed for the release, retain the exact public
snapshots as `sources/<name>.md` or `sources/<name>.txt`. A reviewer checks which original
URLs are authoritative, which bytes were retrieved, the observed recipe redirect,
the time of each observation, and when each observation needs refresh. Keep the
staging directory read-only to other processes during verification and promotion.
The verifier reads staged files only and treats recipe and source text as data.
Publication approval comes from the protected release process.

## Release manifest version 1

Write `release.json` as UTF-8 JSON with two spaces of indentation and a final LF.
Hash exact file bytes with SHA-256 and use lowercase hexadecimal. Record timestamps
in UTC with millisecond precision. The root record has these fields.

| Field | Required value |
| --- | --- |
| `schemaVersion` | `1` |
| `sourceRevision` | The full 40-character Git SHA of the approved source |
| `issuedAt`, `expiresAt` | The release validity window |
| `recipe` | `url`, `redirectTarget`, `sha256`, `observedAt`, and `freshUntil` |
| `sources` | Up to 16 records with `file`, `url`, `sha256`, `observedAt`, and `freshUntil` |
| `renderManifestSha256` | Digest of the canonical renderer's `card.manifest.json` |
| `transformations` | `["layout-reconstruction:svg-v1", "layout-reconstruction:raster-v1"]` |

Use canonical HTTPS URLs without credentials or fragments. The recipe URL must
match the card configuration. Use `null` for `redirectTarget` when the canonical URL
serves the recipe directly. Version 1 supports a single reviewed same-origin
redirect. The staged recipe bytes must be those served by its destination. Refresh
observations when their `freshUntil` time arrives, even if the bundle's signature
has a longer validity window.

The approved publication signer uses an Ed25519 key kept outside the checkout. The
detached signature covers the exact manifest bytes. Set the bundle and signing
key paths in the signer's shell before running this command.

```sh
openssl pkeyutl -sign -rawin -inkey "$ARCC_SIGNING_KEY" \
  -in "$ARCC_BUNDLE/release.json" -out "$ARCC_BUNDLE/release.sig"
```

See the [OpenSSL signing reference](https://docs.openssl.org/3.6/man1/openssl-pkeyutl/).

Before publication, the release operator verifies that signature with an approved
public key and source SHA obtained separately from the bundle.

```sh
node scripts/verify-release.js "$ARCC_BUNDLE" "$ARCC_TRUSTED_PUBLIC_KEY" "$ARCC_REVIEWED_SHA"
```

A passing command prints the reviewed source SHA and signed manifest digest. It
checks the sealed file inventory and current validity, then rebuilds the SVG and PNG
using the pinned renderer and fonts. Publish only the exact bundle associated with
the receipt. Check the live HTTPS content type, redirect and recipe bytes in the
protected promotion step. Pages is configured for workflow publication. A signed
card release requires an approved workflow that verifies the staged bundle before
publication.

## Transformation evidence

| Transformation | Evaluator and decision | Required evidence |
| --- | --- | --- |
| Pixel recovery | A reviewer compares the reader's image-only result with labeled reference spans. Score exact matches, substitutions, and misses for each image variant. | Exact image digest, transformation parameters and version, reader identity and version, labeled spans, and raw recovered spans |
| Web resolution | An observer exercises one named retrieval surface and checks successful resolution against the expected destination, inline text response, and exact recipe bytes. Score each surface independently. | Requested URL, observed redirect, status, media type and disposition, exact response digest where bytes are available, observation time, and the retrieval surface and version |
| Layout reconstruction | The release verifier rebuilds the SVG and PNG with the pinned renderer and compares both files byte for byte. | Signed release digest, verified render manifest digest, configuration and output digests, and renderer and font identities from the render manifest |
| Factual synthesis | A reviewer checks each factual statement against a cited excerpt from a current, admitted source. Record unsupported, stale, or misattributed statements. | Each statement and its finding, exact source URL and excerpt, snapshot digest, observation time and freshness, and reviewer identity |
| Model-assisted generation | An evaluator identified separately from the generating model checks fidelity to the specified task and identifies which passages are quotes, paraphrases, or generated material. | Model and evaluator identities, exact input and output digests, task or rubric version, source excerpts for attributed material, and the fidelity findings |

Record a result, evaluator identity, evaluation time, and retained evidence for each
trial. Use an inconclusive result when required observations are missing. For
example, a surface that cannot expose response bytes can record a retrieval
observation with the digest unavailable. An exact byte match requires response bytes.
An output can have several evidence records. A passing observation applies only
to its own transformation and exact inputs. See the
[interoperability test profile](../tests/interoperability.md) for the trial setup.

To retain layout-reconstruction evidence, run the release check with the optional flag.

```sh
node scripts/verify-release.js "$ARCC_BUNDLE" "$ARCC_TRUSTED_PUBLIC_KEY" "$ARCC_REVIEWED_SHA" --layout-evidence
```

The JSON receipt includes a `layoutEvidence` record with the verification time,
the `byte-match` result, and the SHA-256 digest of the rebuilt render manifest.
Retain the receipt alongside the signed release and its `card.manifest.json`, which
contains the exact configuration, output, renderer, and font identities. Keep live
retrieval observations and reviewer assessments linked to their own inputs.
