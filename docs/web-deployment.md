# ARCC Web deployment profile

ARCC requires only a public recipe URL, but hosted assistants do not all resolve public URLs through the same path. Some products use direct user-directed retrieval, some use search/index infrastructure, and some combine the two. A recipe that works in an ordinary browser can therefore still fail at ARCC L2.

This profile keeps deployment intentionally boring.

## Required

- Serve the recipe over public HTTPS.
- Return UTF-8 text inline. `text/plain; charset=utf-8` is the conservative compatibility choice; `text/markdown; charset=utf-8` is also semantically appropriate when supported.
- Do not force `Content-Disposition: attachment`.
- Keep the recipe usable without JavaScript, authentication, cookies, CAPTCHA, or a browser session.
- Do not put required ARCC semantics only in metadata or a discovery manifest.

## Recommended compatibility surface

A deployment can expose:

```text
/card.md    canonical ARCC recipe
/card       extensionless compatibility alias
/robots.txt crawler policy
/llms.txt   optional LLM-oriented discovery index
```

The compatibility alias should resolve to the same logical recipe. The card image should continue to encode one canonical URL.

## robots.txt

The Robots Exclusion Protocol is standardized by RFC 9309. ARCC itself does not define crawler names. Publishers should use the documented user-agent tokens of retrieval/search systems they intentionally support and should verify those names against current vendor documentation.

A public site that intends broad retrieval can use a permissive baseline:

```text
User-agent: *
Allow: /
```

It may also name supported agents explicitly for clarity. Vendor-specific crawler policy is operational configuration, not part of the ARCC protocol.

## llms.txt

`/llms.txt` is an emerging community convention for giving language-model tools a concise Markdown-oriented map of a site. It is not required by ARCC and should not be treated as equivalent to RFC 9309.

When published, it should link to the canonical ARCC recipe and the smallest useful set of authoritative public sources. The recipe remains authoritative for ARCC behavior.

## What not to publish merely for ARCC

Do not advertise capabilities the site does not implement.

In particular, ARCC does not by itself justify publishing an A2A Agent Card, MCP server manifest, callable-agent endpoint, or other service-discovery document. Those formats describe executable services and capabilities; ARCC is deliberately a static read-only retrieval pattern.

## Verification

Test the deployment at three independent layers:

1. **HTTP:** status, redirect chain, media type, disposition, and bytes.
2. **Browser:** the recipe can be viewed as ordinary text without a forced download or client-side execution.
3. **Assistant:** the target product can actually retrieve the URL through its own hosted Web/search path.

Record failures at the layer where they occur. A successful browser test is evidence for the browser layer, not proof of assistant retrieval compatibility.
