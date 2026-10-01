# Famous Failures — Grokipedia Board

**Live:** https://desurfofficial-ship-it.github.io/people-failures/

A kanban-style app of 1,000,000+ famous-failure scenarios — people, companies, products, films, games, projects. Curated rich playbooks plus a deterministic 1M-card virtual scenario catalog generated at runtime.

## What's in the catalog

| Layer | Count | Notes |
|------|-------|-------|
| Curated hero playbooks | 49 | Hand-crafted in `data.js` with full story, apply, scenarios, resources, takeaway, book recommendation |
| Generated rich playbooks | 1,713 | Templated playbooks derived from a curated seed list of real famous failures (`data-mega-v2.js`) |
| Virtual scenario catalog | 1,000,000 | Deterministic, lazy-generated cards combining the 1,713 seeds × facets × eras × archetypes (`scenario-catalog.js`) |
| **Total cases** | **1,001,762** | All counts verified by `scripts/stress-test.js` |

The 1M virtual scenarios are clearly distinguished from curated playbooks in the UI: every scenario card is tagged `data-synthetic="true"` and labelled "scenario" in the modal.

## Features

- **Home / Browse / Library / Profile** with search, save, playbooks (story / apply / scenarios / books).
- **Virtual scrolling & lazy rendering** — the 1M-scenario column never materialises the full list in the DOM; cards are generated on demand and paginated 60 at a time.
- **Inverted-index search** across the rich playbook set, combined with deterministic prefix expansion over the 1M catalog scenarios. Returns paginated matches with "Load more" buttons.
- **URL hash routing** — `#/browse/<cat>`, `#/search/<q>`, `#/library`, `#/profile`, `#/entry/<id>`. Direct deep links open the right view + modal.
- **Share button** — uses `navigator.share` on mobile, falls back to clipboard with confirmation toast.
- **Service worker** (`sw.js`) — offline-first. Network-first for HTML, cache-first for static assets.
- **Web manifest** (`manifest.webmanifest`) — installable PWA with SVG icon.
- **Accessibility** — keyboard-navigable, focus-visible rings, `prefers-reduced-motion` respected, ARIA labels on interactive elements.
- **IndexedDB / localStorage persistence** — library saved across sessions, profile name, daily pick.
- **Performance hardening** — `byId()` is O(1) via Map; chips and categories are pre-bucketed; searches are throttled (180ms) and paginated.

## Stack

Static HTML/CSS/JS — no build step, no backend, no dependencies. Deployable on any static host (GitHub Pages, Netlify, Cloudflare Pages, S3).

## Files

```
.
├── index.html                  # markup + script tags
├── styles.css                  # dark theme + responsive layout
├── data.js                     # 49 hand-crafted hero playbooks
├── data-mega-v2.js             # 1,713 templated rich playbooks (auto-generated)
├── scenario-catalog-seeds.js  # compact seed list (auto-generated, ~240KB)
├── scenario-catalog.js         # 1M-card deterministic lazy catalog
├── script.js                   # all app logic — views, routing, search, modal
├── sw.js                       # service worker (offline cache)
└── manifest.webmanifest        # PWA manifest
```

## Development

The bulk data is auto-generated from `scripts/seeds.py` — a curated list of ~1,760 real famous-failure entities across 12 categories. To regenerate the data files:

```bash
python3 scripts/generate_mega.py   # produces data-mega-v2.js + scenario-catalog-seeds.js
node   scripts/stress-test.js     # validates IDs, catalog math, search, and totals
```

## Status

- 1,000,000+ scenario cards (target met)
- Production-ready: routing, offline, accessibility, performance hardening
- Bug-fixed: duplicate IDs (`houston`, `tyler`, `newton`) removed; dead placeholder files (`data-bulk-a.js`, `data-mega.js`, `x1.js`) deleted; O(n) lookups replaced with O(1) Map
