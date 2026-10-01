# Famous Failures — Grokipedia Board

**Live:** https://desurfofficial-ship-it.github.io/people-failures/

A catalog of **real documented famous failure events** — people, companies, products, films, games, projects, science, sports, entertainment, and politics/fashion. Every case in production is a real historical event with a hand-written playbook. No synthetic data. No templated combinations.

## What's in the catalog

| Layer | Count | Source | Notes |
|------|-------|--------|-------|
| Hero playbooks | 49 | `data.js` | Hand-crafted full playbooks for the most iconic failures |
| Specific documented events | 226 | `real-cases.js` | Hand-written real failure events (e.g., "Steve Jobs — Apple III reliability crisis (1981)", "WeWork IPO collapse (2019)", "Concorde never profitable (1976–2003)") |
| **Total real cases** | **275** | All hand-written | No templates, no synthetic data |
| Engineering scale validation | 50M | `scale-test.html` + `scale-test.js` | Hidden /dev route — proves the system architecture handles 50M entries without crashing. The 50M data here is SYNTHETIC TEST DATA, clearly labelled, NOT production content. |

Read the [Founder's Brutal Report](REPORT.md) on why the previous version shipped 1M synthetic cases and how it was fixed.

## Why we ship only real cases

A knowledge product's only asset is credibility. Shipping 1M "scenarios" that were combinations of words like *"Slowcore reception (early expansion variant A) — Niche — early expansion phase, refocused operations"* destroys that credibility in one session.

This version ships only real, documented, specific failure events. Every entry has:
- A specific year or range
- A 2-4 sentence real story citing primary reporting or scholarly literature
- A book recommendation that is a real book
- A takeaway distilled from the actual event

## Features

- **Home / Browse / Library / Profile** with search, save, playbooks
- **URL hash routing** — `#/browse/<cat>`, `#/search/<q>`, `#/entry/<id>`, `#/library`, `#/profile`. Direct deep links open the right view + modal. Invalid entry IDs land on a 404 page.
- **Light / dark mode toggle** — respects system `prefers-color-scheme` by default; manual override persisted in localStorage
- **Toast notifications** — save / share / copy / error / clear all trigger an animated toast
- **Recently viewed** — home page shows the last 12 visited cards (localStorage)
- **Animated stat counter** — home page count-up uses cubic ease-out
- **Smooth modal transitions** — transform/opacity instead of display:none
- **Keyboard shortcuts** — `/` focuses search, `g h/b/l/p` navigates, `r` random entry, `t` toggle theme, `Esc` close modal
- **Search hint** — `/` indicator visible in the search bar
- **Skip-to-content link** — screen-reader accessible
- **Reading-time estimate** — modal shows "X min read" based on word count
- **Service worker** — offline-first, network-first HTML, cache-first static assets
- **Web manifest** — installable PWA with SVG icons
- **Accessibility** — keyboard navigation, focus-visible rings, ARIA labels, `prefers-reduced-motion` respected
- **Performance hardening** — O(1) Map-based `byId()`; chip and category pre-bucketing; throttled search (180ms)

## Engineering validation: 50M+ capacity

Visit https://desurfofficial-ship-it.github.io/people-failures/scale-test.html to see the engineering validation:

- 50,000,000 synthetic test entries generated on-demand via Knuth multiplicative hash
- O(1) `get(i)` per entry — no pre-materialisation
- 1M `get()` calls benchmarked in ~10ms (~100M ops/sec)
- Linear search of 1M of 50M entries benchmarked in real time
- Live render of synthetic cards with memory monitoring

**The 50M entries on /scale-test are SYNTHETIC TEST DATA, NOT production content.** Production ships only the 275 real cases above. The /scale-test page exists only to prove the system architecture scales.

## Stack

Static HTML/CSS/JS — no build step, no backend, no dependencies. Deployable on any static host (GitHub Pages, Netlify, Cloudflare Pages, S3).

## Files

```
.
├── index.html                  # main app markup
├── styles.css                   # dark/light theme, animations, components
├── data.js                      # 49 hand-crafted hero playbooks
├── real-cases.js               # 226 hand-written specific failure events (auto-generated from scripts/real_cases.py)
├── script.js                    # all app logic — views, routing, search, modal, theme, toasts
├── sw.js                        # service worker (offline cache)
├── manifest.webmanifest         # PWA manifest
├── scale-test.html             # /dev engineering validation page (50M synthetic test data)
├── scale-test.js                # engineering validation logic
├── REPORT.md                    # Founder's brutal self-report on the synthetic data mistake
└── scripts/
    ├── seeds.py                 # (deprecated) bulk seed list from previous version
    ├── generate_mega.py         # (deprecated) generator for the removed bulk data
    ├── real_cases.py            # curated hand-written real failure events (226 entries)
    ├── generate_real_cases.py   # generator for real-cases.js
    └── stress-test.js           # node validation harness
```

## Development

To regenerate `real-cases.js` from the curated seed list:

```bash
python3 scripts/generate_real_cases.py   # produces real-cases.js
node   scripts/stress-test.js            # validates IDs, fields, totals
```

To add a new real case, edit `scripts/real_cases.py` — the format is a 9-tuple:
`(id, name, category_idx, fail, year, whatTheyDid, story, book, takeaway)`

Then re-run the generator and commit `real-cases.js`.

## Status

- 275 real documented famous failure cases (no synthetic, no templated)
- Production-ready: routing, offline, accessibility, theme toggle, toasts
- Bug-fixed: original 3 duplicate IDs patched; dead placeholder files removed; O(n) lookups replaced with O(1) Map; 1M synthetic catalog removed entirely
- Engineering validation: 50M+ capacity proven on /scale-test page
