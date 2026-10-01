#!/usr/bin/env python3
"""normalize_image_urls.py — convert full upload.wikimedia.org URLs in the
wiki_img_cache.json to just the Commons filename, so the generator can use
the Special:FilePath URL format (which is what data.js hero entries use and
which works reliably on production without rate-limit issues).

URL formats encountered:
  - Original:    https://upload.wikimedia.org/wikipedia/commons/5/59/Foo.png
  - Thumb:       https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Foo.png/400px-Foo.png
  - With query:  .../Foo.png?utm_source=en.wikipedia.org&utm_campaign=...

We extract just "Foo.png" and store it. The script.js imgUrl() function
builds the Special:FilePath URL with the desired width.
"""
import json, re
from pathlib import Path

CACHE_FILE = Path(__file__).parent / 'wiki_img_cache.json'
OUT_FILE = Path(__file__).parent / 'wiki_img_map.json'

def extract_filename(url):
    """Extract Commons filename from an upload.wikimedia.org URL."""
    if not url:
        return None
    # Strip query string
    url = url.split('?')[0]
    # Strip fragments
    url = url.split('#')[0]
    # Match Commons path patterns:
    #   /wikipedia/commons/5/59/Foo.png
    #   /wikipedia/commons/thumb/5/59/Foo.png/400px-Foo.png  -> use Foo.png
    #   /wikipedia/en/6/64/Foo.png
    #   /wikipedia/en/thumb/6/64/Foo.png/400px-Foo.png
    m = re.search(r'/wikipedia/[a-z]+(?:/thumb)?/[\da-f]{1,2}/[\da-f]{1,2}/([^/]+?)(?:/\d+px-[^/]+)?$', url)
    if not m:
        # Fallback: just take the last path segment without the size prefix
        last = url.rsplit('/', 1)[-1]
        # Strip "NNNpx-" prefix if it's a thumb
        last = re.sub(r'^\d+px-', '', last)
    else:
        last = m.group(1)
    # URL-decode so filenames match the format in data.js
    # (e.g., "Steve_Jobs_Headshot_2010_%28cropped_4%29.jpg" → "Steve_Jobs_Headshot_2010_(cropped_4).jpg")
    import urllib.parse
    return urllib.parse.unquote(last)


def main():
    cache = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}
    normalized = {}
    skipped = 0
    for k, v in cache.items():
        if not v:
            continue
        fn = extract_filename(v)
        if fn and re.search(r'\.(jpg|jpeg|png|gif|svg)$', fn, re.I):
            normalized[k] = fn
        else:
            skipped += 1
            print(f'  SKIP {k}: {fn[:60] if fn else "(none)"}')
    print(f'\nNormalized {len(normalized)} URLs to Commons filenames (skipped {skipped})')

    # Update cache with the filenames
    for k in list(cache.keys()):
        if k in normalized:
            cache[k] = normalized[k]
        elif cache[k]:
            # Failed to normalize — clear it so initials show
            cache[k] = None
            print(f'  CLEARED {k} (failed to normalize)')
    CACHE_FILE.write_text(json.dumps(cache, indent=2))

    # Rebuild output map
    out = {k: v for k, v in cache.items() if v}
    OUT_FILE.write_text(json.dumps(out, indent=2))
    found = sum(1 for v in out.values() if v)
    print(f'\nFinal: {found} entries with Commons filenames')
    # Sample
    for k in list(out.keys())[:5]:
        print(f'  {k}: {out[k]}')


if __name__ == '__main__':
    main()
