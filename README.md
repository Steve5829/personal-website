# Steve Chen · Engineering portfolio

A static portfolio for 2027 new-grad software engineering opportunities: selected projects, source-linked case studies, a searchable engineering notebook, and the TraceGate replay lab.

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
| `case-study.html?id=godot` | Godot Vibe case study. Other IDs: `pocketpy`, `spelltide`, `integrations`. |
| `notes.html` | Sixteen engineering notes with text search, topic filters, native disclosure controls, and source links. |
| `notes.html?note=serialization-invariants` | A shareable link to one open note. Search and category parameters are also preserved. |
| `lab.html` | TraceGate's recorded policy-evaluation scenarios, including inputs, reason codes, and reproducible reports. |
| `assets/Steve_Chen_Resume.pdf` | Downloadable resume. |

## Content

- Edit project stories in `data/cases.json` and notebook entries in `data/notes.json`.
- The lab's `data/lab.json` is generated from actual TraceGate fixture runs; follow the TraceGate project's exporter instructions when refreshing it.
- Headline and role information come from the supplied resume. Upstream contribution links provide public implementation evidence.
- The four homepage project illustrations are conceptual artwork, not screenshots or performance measurements.
- Keep employer metrics, confidential source material, raw interview preparation, credentials, and private research files out of this repository. The site does not present study notes as proof of professional mastery.

## Design and accessibility

Off-white, deep teal, and restrained green accents continue the original site's palette. Layouts adapt to narrow screens, motion respects reduced-motion preferences, form controls have labels, disclosures use native `details`, and every page has a keyboard skip link. Page renderers insert text with DOM APIs and restrict data-driven links to HTTP(S).

## Publishing

This repository targets GitHub Pages at `/personal-website/`. Asset and page links are relative to support that project path. Publish the reviewed branch through the repository's Pages workflow or merge into the configured Pages source; no application server or secrets are needed for hosting.

The site links to [Godot Vibe v2](https://github.com/Steve5829/godot-vibe-plugin/tree/v2), [sbx_extension](https://github.com/Steve5829/sbx_extension), [TraceGate](https://github.com/Steve5829/tracegate), [AI Support Agent](https://github.com/Steve5829/emotion-ai-agent), and merged pocketpy pull requests [#487](https://github.com/pocketpy/pocketpy/pull/487) and [#519](https://github.com/pocketpy/pocketpy/pull/519).
