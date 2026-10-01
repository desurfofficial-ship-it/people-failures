#!/usr/bin/env python3
"""fetch_wiki_images_fallback.py — second-pass fetcher for entries that
had no infobox image. Uses MediaWiki `images` + `imageinfo` props to find
the first relevant photo on the page (skips logos, flags, icons, etc.).

Reads scripts/wiki_img_cache.json, finds entries still missing an image,
tries the fallback, and updates the cache.
"""
import urllib.request, urllib.parse, urllib.error, json, sys, time, re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from real_cases import REAL_CASES

CACHE_FILE = Path(__file__).parent / 'wiki_img_cache.json'
OUT_FILE = Path(__file__).parent / 'wiki_img_map.json'

WIKI_OVERRIDES = {
    "heavens-gate-ua": "Heaven's Gate (film)",
    "heavens-gate": "Heaven's Gate (film)",
    "ltcm-russian-default": "Long-Term Capital Management",
    "versace-murder-1997": "Gianni Versace",
    "theranos-fraud-2003-2018": "Theranos",
    "theranos-2003-2018-collapse": "Theranos",
    "pets-com-superbowl": "Pets.com",
    "moviepass-1-dollar": "MoviePass",
    "juicero-squeezable": "Juicero",
    "google-plus-shutdown": "Google+",
    "lawbreakers-shut": "LawBreakers",
    "wework-ipo-collapse": "WeWork",
    "neumann-wework-s1": "WeWork",
    "better-zoom-layoffs": "Better.com",
    "better-com-2021-zoom": "Better.com",
    "gm-bankruptcy-2009": "General Motors",
    "musk-twitter-acquisition": "Acquisition of Twitter by Elon Musk",
    "zuck-beacon-lawsuit": "Facebook Beacon",
    "zuck-cambridge-analytica": "Facebook–Cambridge Analytica data scandal",
    "zuck-libra-diem": "Diem (digital currency)",
    "ellison-google-java": "Google LLC v. Oracle America, Inc.",
    "mayer-yahoo-tumblr": "Yahoo!",
    "sbf-ftx-collapse": "Bankruptcy of FTX",
    "acton-yahoo-rejection": "Brian Acton",
    "butterfield-glitch-slack": "Stewart Butterfield",
    "jobs-mobileme": "MobileMe",
}

# Skip these patterns when picking the most relevant image
SKIP_PATTERNS = [
    'commons-logo', 'commons-icon', 'question_book', 'wiki_letter', 'disambig',
    'red_pog', 'wiki.png', 'edit-clear', 'magazine', 'wiktionary', 'wikiquote',
    'wikisource', 'wikibooks', 'wikimedia', 'commons-', 'symbol', 'flag',
    'ambox', 'content_may_include', 'nuvola', 'crystal_clear', 'gnome_app',
    'pictogram', 'icon', 'logo', 'seal', 'coat_of_arms', 'map', 'p_d',
    'copyright', 'pd-', 'text_document', 'editing', 'reliable_sources',
    'ojs_ui', 'sound-icon', 'silk-icon', 'kfm_', 'hand.svg', 'scales',
    'svg.png', 'commons.svg', 'wikimedia', 'special:', 'upload.wikimedia.',
    'edit', 'reflection', 'globe', 'arrow', 'crystal', 'merge',
    'cscr', 'clock', 'pages', 'star', 'green_check', 'red_x', 'yes_check',
    'unchecked', 'x_mark', 'no_image', 'no_portrait', 'replace_this_image',
    'link_fa', 'thumb_up', 'five_over_eight', 'featured', 'good_article',
    'spoken', 'article_please', 'ipa', ' Portal', 'portal', 'article_icon',
    'wiki_letter_w', 'hatnote', 'silk', 'silk_icon', 'edit-paste', 'face-smile',
    'mid_1_', 'mid_2_', 'mid_3_', 'lta', 'logo_of', 'registration',
    'increasing', 'decreasing', 'important', 'ticket',
    'document', 'increase', 'decrease', 'trend', 'plot', 'chart',
    'stop', 'go', 'merge', 'split', 'redirect', 'move',
    'highvandal', 'vandal', 'admin', 'rollback', 'block',
    'user_icon', 'an_user', 'anonymous',
]


def http_get(url, timeout=15):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'people-failures/1.0 (https://desurfofficial-ship-it.github.io/people-failures/; educational project)'
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def list_page_images(title):
    """List all images on a Wikipedia article page."""
    safe = urllib.parse.quote(title.replace(' ', '_'))
    url = f'https://en.wikipedia.org/w/api.php?action=query&titles={safe}&prop=images&format=json&imlimit=30'
    try:
        data = http_get(url)
    except Exception as e:
        return []
    pages = data.get('query', {}).get('pages', {})
    out = []
    for pid, p in pages.items():
        for img in p.get('images', []):
            t = img.get('title', '')
            if t.startswith('File:'):
                t = t[5:]
            out.append(t)
    return out


def pick_best_image(titles):
    """Pick the first non-iconic image filename from a list."""
    for t in titles:
        lower = t.lower()
        # Skip if any skip pattern matches
        if any(p in lower for p in SKIP_PATTERNS):
            continue
        # Skip if no extension or weird extension
        if not re.search(r'\.(jpg|jpeg|png|gif|svg)$', lower):
            continue
        # Skip very small utility files
        if len(t) < 8:
            continue
        return t
    return None


def fetch_image_url(filename):
    """Get the actual image URL via imageinfo prop."""
    safe = urllib.parse.quote('File:' + filename)
    url = f'https://en.wikipedia.org/w/api.php?action=query&titles={safe}&prop=imageinfo&format=json&iiprop=url|size&iiurlwidth=400'
    try:
        data = http_get(url)
    except Exception:
        return None
    pages = data.get('query', {}).get('pages', {})
    for pid, p in pages.items():
        ii = p.get('imageinfo', [])
        if ii:
            # Prefer thumburl (resized) for performance
            return ii[0].get('thumburl') or ii[0].get('url')
    return None


def main():
    cache = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}
    n = len(REAL_CASES)
    misses = [c for c in REAL_CASES if not cache.get(c[0])]
    print(f'Processing {len(misses)} entries with no image yet (out of {n})')

    for i, case in enumerate(misses):
        cid = case[0]
        name = case[1]
        title = WIKI_OVERRIDES.get(cid, name)
        print(f'  [{i+1:3d}/{len(misses)}] {cid:40s} {name[:40]:40s} -> {title[:50]}', end=' ')

        try:
            imgs = list_page_images(title)
            picked = pick_best_image(imgs)
            if not picked:
                print('NO IMAGE')
                cache[cid] = None
                continue
            img_url = fetch_image_url(picked)
            if img_url:
                cache[cid] = img_url
                print(f'OK {picked[:40]}')
            else:
                print('NO URL')
                cache[cid] = None
        except urllib.error.HTTPError as e:
            if e.code == 429 or 'Too Many' in str(e):
                print(f'RATE-LIMIT, sleeping 60s')
                time.sleep(60)
                # retry this one
                continue
            print(f'ERR HTTP {e.code}')
            cache[cid] = None
        except Exception as e:
            print(f'ERR {type(e).__name__}: {e}')
            cache[cid] = None

        time.sleep(1.5)  # be very polite

    CACHE_FILE.write_text(json.dumps(cache, indent=2))

    # Rebuild the output map
    out = {}
    for case in REAL_CASES:
        cid = case[0]
        out[cid] = cache.get(cid)
    OUT_FILE.write_text(json.dumps(out, indent=2))

    found = sum(1 for v in out.values() if v)
    print(f'\n--- Final ---')
    print(f'Images: {found}/{n} ({100*found//n}%)')


if __name__ == '__main__':
    main()
