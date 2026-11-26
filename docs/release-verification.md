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
protected promotion step. The repository's current Pages configuration publishes
from `main`. The owner must move card publication behind an approved verification
step before using that source branch for a signed release.

## Transformation evidence

| Transformation | What the result may claim | Required evidence |
| --- | --- | --- |
| Pixel recovery | Text recovered from the image pixels | Exact image digest, transformation and reader versions, recovered spans compared with the labeled reference, and recorded misses |
| Web resolution | The recipe or link resolved through a particular retrieval path | Recovered URL, observed redirect and media type, exact returned digest, observation time, and the browser or assistant retrieval surface |
| Layout reconstruction | An SVG or raster representation reproduced from admitted design inputs | Configuration and output digests, renderer and font identities, and a byte comparison after rebuilding |
| Factual synthesis | Statements grounded in public sources | Statement-level source and excerpt references, snapshot digests, freshness, and a reviewer checking attribution and unsupported claims |
| Model-assisted generation | Model-generated output or interpretation | Model and evaluation identities, exact input and output digests, separation of quoted source support from generation, and a fidelity assessment |

Version 1 verifies the deterministic layout and raster steps. The same bundle can
carry independently reviewed recipe and source observations. Record pixel
readability and assistant retrieval trials separately under
[the interoperability test profile](../tests/interoperability.md).
