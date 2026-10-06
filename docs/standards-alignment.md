# ARCC standards alignment

This note maps the current ARCC recipe vocabulary to existing identity, Web-link, and accessibility terms. It recommends reuse where meanings match and keeps ARCC-specific trust rules explicit.

## Identity fields

| ARCC recipe concept | vCard 4.0 | Schema.org `Person` | Recommended use |
| --- | --- | --- | --- |
| Name | `FN` (formatted name) | `name` | Use the person's public name as written. Do not require a structured vCard `N` decomposition. |
| Display name | No exact equivalent; `NICKNAME` is only a nickname | `alternateName` | Optional alias or alternate name. Do not treat every preferred display form as a nickname or infer a legal name. |
| Primary role | `TITLE` for position/job; `ROLE` for a function or part played in a particular situation | `jobTitle` | Use `TITLE` / `jobTitle` for a current job title. Use `ROLE` only when the context-specific function is intended. |
| Canonical site | `URL` | `url` | The person's public identity site. This is separate from the recipe URL encoded in the card, which points to ARCC instructions. |
| Same-person identity URL | `URL` can carry a related URL but does not assert identity equivalence | `sameAs` | Use only for a page that unambiguously identifies the same person. Do not label every source or project link `sameAs`. |

ARCC recipes remain readable Markdown. These correspondences do not require vCard export or a Schema.org serialization.

## Sources and Web links

Keep the recipe's source table labeled with `Source`, `URL`, and `Use for`. The `Use for` text plus the recipe's precedence rules say what a source can support; a link relation alone does not establish source authority or trust.

When a hosted HTML page or HTTP response exposes typed links, registered Web Linking relations can express some of the same relationships:

| Relationship | Registered relation | Use |
| --- | --- | --- |
| Card or profile context points to its explanatory recipe | `describedby` | Appropriate when the recipe describes the linked card or page. |
| Page points to another page about its author / same person | `me` | Use only when the destination is an identity page for that same person. |
| A document points to an information source | `via` | Appropriate for provenance links; retain an explicit `Use for` description in the recipe. |
| Resource points to its author | `author` | Use only for actual authorship, not for employment, evidence, or general affiliation. |

RFC 8288 distinguishes registered relation tokens from extension relations. ARCC should reuse an applicable registered token and should not invent a general-purpose `source` relation. A Markdown source table is sufficient for ordinary cards.

RFC 9264 defines Linkset media types and the `linkset` relation for a standalone set of Web links. A deployment with a large link inventory may expose a Linkset as an optional index; it should not replace the concise recipe or its source descriptions.

## Structured data and discovery

Keep Markdown plus conventional links as the canonical recipe. Do not require JSON-LD inside the recipe: that would duplicate identity fields and can drift from the human-readable source. A hosted HTML page may optionally publish a small Schema.org `Person` JSON-LD projection using `name`, `alternateName`, `jobTitle`, `url`, and carefully selected `sameAs` values. That projection is supplementary; the recipe remains sufficient and authoritative for ARCC retrieval rules, source precedence, and safety constraints.

`/llms.txt` is an emerging community proposal for site discovery, not an ARCC requirement or an IETF/W3C standards-track format. It may point to the canonical recipe, but it does not replace the recipe or change its trust boundary.

For an HTML image embed, follow WCAG's text-alternative expectation for non-text content and provide useful `alt` text for the human-facing calling-card purpose and identity. `alt` text remains an accessibility aid; it is not the ARCC bootstrap, which must still be present in image pixels.

## Proposed specification and template edits

The edits in this change apply the following recommendations:

- In `SPEC.md`, map `Name`, `Display name`, `Primary role`, and `Canonical site` to the existing field meanings above; clarify that the card's recipe URL and the person's canonical site are distinct.
- Keep the source table and precedence rules as the recipe's authority. Mention registered relations only as optional Web serialization and state that they do not establish trust.
- Keep JSON-LD optional and supplementary, and keep `llms.txt` explicitly non-normative.
- In `templates/card.md`, retain its plain labels and add short guidance for the role/title distinction and the evidentiary scope of each source.

## References

- [RFC 6350: vCard Format Specification](https://www.rfc-editor.org/rfc/rfc6350)
- [Schema.org `Person`](https://schema.org/Person), [`alternateName`](https://schema.org/alternateName), [`jobTitle`](https://schema.org/jobTitle), [`sameAs`](https://schema.org/sameAs), and [`url`](https://schema.org/url)
- [RFC 8288: Web Linking](https://www.rfc-editor.org/rfc/rfc8288) and the [IANA Link Relations registry](https://www.iana.org/assignments/link-relations/link-relations.xhtml)
- [RFC 9264: Linkset](https://www.rfc-editor.org/rfc/rfc9264)
- [WCAG 2.2, Success Criterion 1.1.1](https://www.w3.org/TR/WCAG22/#non-text-content) and the [WAI image alt decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- [The `/llms.txt` proposal](https://llmstxt.org/)
