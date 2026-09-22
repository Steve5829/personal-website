# Steve Chen · Engineering portfolio

A static portfolio and personal knowledge workspace for 2027 new-grad software engineering: source-linked projects, an editable knowledge network, job-to-evidence matching, interview rehearsal, and the TraceGate replay lab.

**Live site:** [steve5829.github.io/personal-website](https://steve5829.github.io/personal-website/)

## Run locally

The site uses HTML, CSS, and vanilla JavaScript. It has no package installation or build step. Use a working Python 3 installation to serve the folder over HTTP:

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). Use an HTTP server instead of opening the HTML files directly, because the case studies, notebook, and lab load local JSON with `fetch`.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Selected work, accepted upstream contributions, four experience entries, and contact details. Core content works without JavaScript. |
| `knowledge.html` | 97 nodes, 169 typed relationships, 32 interview prompts and six curated paths; search, explore connections, add local knowledge, match job requirements, rehearse and export progress. |
| `knowledge.html?view=job` | Paste a job description to find source-tagged work, contextual learning material and unmatched known technologies; export a Markdown preparation pack. |
| `knowledge.html?view=practice` | Write answers, inspect reference material and self-rate to schedule the next review. |
| `knowledge-guide.html` | Chinese instructions, provenance labels and backup behavior. |
| `case-study.html?id=godot` | Godot Vibe case study. Other IDs: `pocketpy`, `spelltide`, `integrations`. |
| `notes.html` | Sixteen engineering notes with text search, topic filters, native disclosure controls, and source links. |
| `notes.html?note=serialization-invariants` | A shareable link to one open note. Search and category parameters are also preserved. |
| `lab.html` | TraceGate's recorded policy-evaluation scenarios, including inputs, reason codes, and reproducible reports. |
| `assets/Steve_Chen_Resume.pdf` | Downloadable resume. |

## Content

- Edit project stories in `data/cases.json` and notebook entries in `data/notes.json`.
- The public knowledge graph is `knowledge-data.js`; the pure browser/CommonJS engine is `knowledge-engine.js`. `knowledge.js` manages the UI and local state. The graph script deliberately avoids `fetch`, so the knowledge workspace and guide can also be opened directly from an extracted offline bundle.
- The lab's `data/lab.json` is generated from actual TraceGate fixture runs; follow the TraceGate project's exporter instructions when refreshing it.
- Headline and role information come from the supplied resume. Upstream contribution links provide public implementation evidence.
- The four homepage project illustrations are conceptual artwork, not screenshots or performance measurements.
- Keep employer metrics, confidential source material, raw interview preparation, credentials, and private research files out of this repository. The site does not present study notes as proof of professional mastery.

## Knowledge workspace behavior

The graph separates upstream sources, resume statements, personal notes, study material and new assistant-supported builds. Job matching recognizes an explicit technical alias dictionary; it is not a semantic AI assessment or an eligibility score. Merely linking a study concept to a project does not turn it into work evidence. Match cards expose the source field and the underlying nodes.

Answers, notes, added nodes and review dates are stored in the current browser under `steve-knowledge-workspace-v1`. Nothing sends them to a server. Job text stays in page memory until exported. Export/import JSON transfers personal state across devices; import validates references and size limits, and downloads a backup before replacing nonempty state. Browser storage failures are surfaced without claiming successful persistence. Clearing browser data can remove local records. Public and offline copies have separate storage.

The network, matching engine and interview workspace were developed with coding-assistant support in September 2026. The graph's historical claims retain their original source tiers. The public resume preserves the supplied PDF layout and body, with only the phone removed from the contact line.

## Verification

Use Node.js 18 or newer:

```sh
node --test tests/knowledge-engine.test.cjs
```

The 32 tests cover real graph integrity, bilingual search, technology-name boundaries, graph direction and cycles, evidence attribution, deterministic review schedules and hostile/malformed state inputs. GitHub Pages deployment requires these tests. Browser checks also cover actual search-to-question navigation, answer persistence, local-node creation, a downloaded backup round trip, rejection of invalid backups, job-output invalidation and 320/390 px layouts.

## Design and accessibility

Off-white, deep teal, and restrained green accents continue the original site's palette. Layouts adapt to narrow screens, motion respects reduced-motion preferences, form controls have labels, disclosures use native `details`, and every page has a keyboard skip link. Page renderers insert text with DOM APIs and restrict data-driven links to HTTP(S).

## Publishing

This repository targets GitHub Pages at `/personal-website/`. Asset and page links are relative to support that project path. Publish the reviewed branch through the repository's Pages workflow or merge into the configured Pages source; no application server or secrets are needed for hosting.

The site links to [Godot Vibe v2](https://github.com/Steve5829/godot-vibe-plugin/tree/v2), [sbx_extension](https://github.com/Steve5829/sbx_extension), [TraceGate](https://github.com/Steve5829/tracegate), [AI Support Agent](https://github.com/Steve5829/emotion-ai-agent), and merged pocketpy pull requests [#487](https://github.com/pocketpy/pocketpy/pull/487) and [#519](https://github.com/pocketpy/pocketpy/pull/519).
