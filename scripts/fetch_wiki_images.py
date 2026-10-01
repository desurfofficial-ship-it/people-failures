#!/usr/bin/env python3
"""fetch_wiki_images.py — fetch Wikipedia thumbnail URLs for all real cases.

For each entry in scripts/real_cases.py, query the Wikipedia REST API to
fetch the entity's thumbnail image URL. Cache results locally so re-runs
are instant. Output a JSON map of {id: imgUrl} for the generator to use.

Strategy:
  1. Use the entity name (case[1]) as the Wikipedia article title.
  2. If that fails (404), try variants: strip parenthetical, strip " - " suffix.
  3. If a manual override exists in WIKI_OVERRIDES, use that instead.
  4. Cache to scripts/wiki_img_cache.json so subsequent runs are instant.

Politeness:
  - User-Agent set with project URL and contact
  - 150ms delay between requests (well within Wikipedia's 200 req/sec limit)
  - Caches all results (including None) to avoid retries
"""
import urllib.request, urllib.parse, urllib.error, json, os, sys, time, re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from real_cases import REAL_CASES

CACHE_FILE = Path(__file__).parent / 'wiki_img_cache.json'
OUT_FILE = Path(__file__).parent / 'wiki_img_map.json'

# Manual overrides for entries where the entity name != Wikipedia article title.
# Format: { case_id: article_title }
WIKI_OVERRIDES = {
    # Films where the bare title is ambiguous
    "heavens-gate": "Heaven's Gate (film)",
    "gigli-2003": "Gigli (film)",
    "pluto-nash-bomb": "The Adventures of Pluto Nash",
    "battlefield-earth": "Battlefield Earth (film)",
    "cats-2019": "Cats (2019 film)",
    "cats-2019-flop": "Cats (2019 film)",
    "john-carter-disney": "John Carter (film)",
    "lone-ranger-2013": "The Lone Ranger (2013 film)",
    "fantastic-four-2015": "Fantastic Four (2015 film)",
    "the-flash-2023": "The Flash (film)",
    "madame-web-2024": "Madame Web (film)",
    "morbius-2022": "Morbius (film)",
    "kraven-2024": "Kraven the Hunter (film)",
    "fantastic-four-1994": "The Fantastic Four (unreleased film)",
    "cutthroat-island-carolco": "Cutthroat Island",
    "waterworld": "Waterworld",  # exists
    "the-flash-2023": "The Flash (film)",
    "john-carter-2012-bomb": "John Carter (film)",
    "cats-2019-flop": "Cats (2019 film)",
    # Companies / events where the bare title needs disambiguation
    "enron-fraud": "Enron scandal",
    "worldcom-fraud": "MCI Inc.",  # WorldCom was renamed
    "lehman-collapse": "Bankruptcy of Lehman Brothers",
    "bear-stearns-collapse": "Bear Stearns",
    "ltcm-russian-default": "Long-Term Capital Management",
    "pets-com-superbowl": "Pets.com",
    "webvan-bankruptcy": "Webvan",
    "blockbuster-passed-on-netflix": "Blockbuster LLC",
    "kodak-digital-delay": "Kodak",
    "theranos-fraud": "Theranos",
    "wework-ipo-collapse": "WeWork",
    "moviepass-1-dollar": "MoviePass",
    "juicero-squeezable": "Juicero",
    "quibi-6-month-shutdown": "Quibi",
    "better-zoom-layoffs": "Better.com",
    "theranos-fraud-2003-2018": "Theranos",
    "theranos-wsj": "Theranos",
    # Products that need disambiguation
    "google-glass-flop": "Google Glass",
    "google-glass-explorer": "Google Glass",
    "google-stadia-shutdown": "Google Stadia",
    "firephone-flop": "Amazon Fire Phone",
    "amazon-fire-phone-2014": "Amazon Fire Phone",
    "samsung-note7-recall": "Samsung Galaxy Note 7",
    "samsung-fold-2019": "Samsung Galaxy Fold",
    "betamax-lost-vhs": "Betamax",
    "hd-dvd-vs-bluray": "HD DVD",
    "new-coke-revolt": "New Coke",
    "new-coke-1985-revolt": "New Coke",
    "apple-pippin-flop": "Apple Pippin",
    "google-plus-shutdown": "Google+",
    "microsoft-kin-2": "Microsoft Kin",
    "microsoft-zune": "Microsoft Zune",
    "microsoft-zune-2006": "Microsoft Zune",
    "apple-airpower-cancelled": "AirPower",
    "apple-newton-1993": "Apple Newton",
    "newton-pda-flop": "Apple Newton",
    "apple-lisa-flop": "Apple Lisa",
    "apple-lisa-1983-burial": "Apple Lisa",
    "apple-maps-2012-launch": "Apple Maps",
    "apple-maps-2022-relaunch": "Apple Maps",
    "apple-butterfly-keyboard-2015": "MacBook (2015–2019)",
    "apple-maps-launch": "Apple Maps",
    "vista-2007": "Windows Vista",
    "windows-phone-7-launch": "Windows Phone",
    "windows-rt": "Windows RT",
    "intel-itanium": "Itanium",
    "windows-me": "Windows Me",
    "windows-phone-launch": "Windows Phone",
    "crystal-pepsi-1992": "Crystal Pepsi",
    # Projects
    "concorde-never-profitable": "Concorde",
    "spruce-goose-1-flight": "Hughes H-4 Hercules",
    "big-dig-overrun": "Big Dig (Boston)",
    "california-hsr-overrun": "California High-Speed Rail",
    "hs2-cancelled-northern": "High Speed 2",
    "crossrail-delays": "Crossrail",
    "french-panama-canal": "Panama Canal",
    "hyperloop-one-shutdown": "Virgin Hyperloop",
    "boeing-starliner-delays": "Boeing Starliner",
    "boeing-737-max-crashes": "Boeing 737 MAX",
    "three-mile-island": "Three Mile Island accident",
    "three-mile-island-1979": "Three Mile Island accident",
    "chernobyl-disaster": "Chernobyl disaster",
    "chernobyl-1986-disaster": "Chernobyl disaster",
    "fukushima-disaster": "Fukushima nuclear accident",
    "fukushima-2011-disaster": "Fukushima nuclear accident",
    "bp-deepwater-horizon": "Deepwater Horizon",
    "deepwater-horizon-2010": "Deepwater Horizon",
    "bhopal-disaster": "Bhopal disaster",
    "bhopal-1984-disaster": "Bhopal disaster",
    "thai-cave-rescue": "Tham Luang cave rescue",
    "afghanistan-2021-withdrawal": "Withdrawal of United States troops from Afghanistan (2020–2021)",
    "iraq-wmd-intelligence": "Iraq and weapons of mass destruction",
    "spanish-flu-1918": "Spanish flu",
    "covid-19-pandemic": "COVID-19 pandemic",
    "apollo-1-fire": "Apollo 1",
    "apollo-13-mission": "Apollo 13",
    "challenger-sts-51-l": "Space Shuttle Challenger disaster",
    "columbia-sts-107": "Space Shuttle Columbia disaster",
    # Games
    "atari-et-landfill": "E.T. the Extra-Terrestrial (video game)",
    "daikatana-romeros-bitch": "Daikatana",
    "dukenukem-forever": "Duke Nukem Forever",
    "anthem-abandoned": "Anthem (video game)",
    "fallout-76-launch": "Fallout 76",
    "no-mans-sky-launch": "No Man's Sky",
    "cyberpunk-2077-removed-ps-store": "Cyberpunk 2077",
    "sw-battlefront-2-lootbox": "Star Wars Battlefront II (2017 video game)",
    "babylons-fall-shut": "Babylon's Fall",
    "marvel-avengers-shutdown": "Marvel's Avengers (video game)",
    "concord-shut-2-weeks": "Concord (video game)",
    "lawbreakers-shut": "LawBreakers",
    "simcity-2013-launch": "SimCity (2013 video game)",
    "spore-drm-backlash": "Spore (2008 video game)",
    "wildstar-shutdown": "WildStar (video game)",
    "wildstar-2": "WildStar (video game)",
    "wildstar-3": "WildStar (video game)",
    "city-of-heroes-shutdown": "City of Heroes",
    "star-wars-galaxies-shutdown": "Star Wars Galaxies",
    "rift-shutdown": "Rift (video game)",
    "hyper-scape-shutdown": "Hyper Scape",
    "evolve-stage-2-shutdown": "Evolve (video game)",
    # Sports teams / events
    "jordan-cut-team": "Michael Jordan",
    "jordan-baseball-stint": "Michael Jordan",
    "jordan-wizards-comeback": "Michael Jordan",
    "lebron-2011-finals": "LeBron James",
    "rose-acl-tear": "Derrick Rose",
    "bird-back-injuries": "Larry Bird",
    "tiger-2009-scandal": "Tiger Woods",
    "tiger-woods-2019-comeback": "Tiger Woods",
    "ali-exile-1967-70": "Muhammad Ali",
    "muhammad-ali-return-1970": "Muhammad Ali",
    "kobe-2003-colorado": "Kobe Bryant",
    "shaq-free-throws": "Shaquille O'Neal",
    "roger-clemens-steroid": "Roger Clemens",
    "joe-louis-tax-debt": "Joe Louis",
    "ted-williams-wwii-interruption": "Ted Williams",
    "ted-williams-2": "Ted Williams",
    "williams-2": "Ted Williams",
    "james-naismith-invented": "James Naismith",
    # Politics
    "lincoln-1858-loss": "Abraham Lincoln",
    "lincoln-assassination": "Assassination of Abraham Lincoln",
    "churchill-gallipoli": "Winston Churchill",
    "churchill-1945-loss": "Winston Churchill",
    "fdr-polio": "Franklin D. Roosevelt",
    "mandela-27-years": "Nelson Mandela",
    "gandhi-south-africa": "Mahatma Gandhi",
    "mlk-jail-1963": "Martin Luther King Jr.",
    "truman-haberdashery-bankruptcy": "Harry S. Truman",
    "kennedy-bay-of-pigs": "Bay of Pigs Invasion",
    "nixon-watergate": "Watergate scandal",
    "carter-iran-hostage": "Iran hostage crisis",
    # Science
    "galileo-house-arrest": "Galileo Galilei",
    "mendel-ignored": "Gregor Mendel",
    "semmelweis-asylum": "Ignaz Semmelweis",
    "mcclintock-ignored": "Barbara McClintock",
    "hopper-compiler-ridiculed": "Grace Hopper",
    "lavoisier-execution": "Antoine Lavoisier",
    "tesla-wardenclyffe": "Nikola Tesla",
    "edison-dc-ac-loss": "War of the currents",
    "ramanujan-self-taught": "Srinivasa Ramanujan",
    "mccarthy-ai-winter": "Marvin Minsky",
    "higgs-slow-recognition": "Peter Higgs",
    # Literature
    "melville-moby-dick-flop": "Moby-Dick",
    "austen-anonymous": "Jane Austen",
    "dickens-family-debts": "Charles Dickens",
    "bronte-charlotte-pseudonym": "Charlotte Brontë",
    "dostoevsky-gambling-debts": "Fyodor Dostoevsky",
    "dostoevsky-mock-execution": "Fyodor Dostoevsky",
    "kafka-obscure": "Franz Kafka",
    "fitzgerald-late-struggles": "F. Scott Fitzgerald",
    "orwell-poverty-tb": "George Orwell",
    "orwell-spanish-civil-war": "George Orwell",
    "woolf-illness": "Virginia Woolf",
    "hughes-poverty": "Langston Hughes",
    "hurston-obscurity": "Zora Neale Hurston",
    "tolstoy-spiritual-crisis": "Leo Tolstoy",
    # Entertainment
    "presley-late-decline": "Elvis Presley",
    "cash-1960s-pills": "Johnny Cash",
    "cobain-suicide": "Kurt Cobain",
    "mj-pepsi-burn": "Michael Jackson",
    "prince-name-change": "Prince (musician)",
    "britney-conservatorship": "Britney Spears",
    "sinead-1992-backlash": "Sinéad O'Connor",
    "amy-winehouse-addiction": "Amy Winehouse",
    "nippy-houston-decline": "Whitney Houston",
    "marley-assassination-attempt": "Bob Marley",
    # Fashion
    "versace-murder-1997": "Gianni Versace",
    "mcqueen-suicide-2010": "Alexander McQueen",
    "galliano-2011-rant": "John Galliano",
    "chanel-collaboration": "Coco Chanel",
    # Misc business
    "jobs-apple-iii": "Apple III",
    "jobs-lisa": "Apple Lisa",
    "jobs-ouster-1985": "Steve Jobs",
    "jobs-next-cube": "NeXT",
    "jobs-newton-cancellation": "Apple Newton",
    "jobs-mobileme": "MobileMe",
    "jobs-antennagate": "IPhone 4",
    "jobs-apple-maps": "Apple Maps",
    "jobs-airpower": "AirPower",
    "jobs-apple-butterfly-keyboard": "MacBook (2015–2019)",
    "gates-msn-tv": "WebTV",
    "gates-microsoft-bob": "Microsoft Bob",
    "gates-windows-me": "Windows Me",
    "musk-falcon-1-1": "Falcon 1",
    "musk-falcon-1-2": "Falcon 1",
    "musk-falcon-1-3": "Falcon 1",
    "musk-tesla-roadster-delays": "Tesla Roadster (first generation)",
    "musk-olarogog": "Tesla, Inc.",
    "musk-twitter-acquisition": "Acquisition of Twitter by Elon Musk",
    "musk-cybertruck-recalls": "Tesla Cybertruck",
    "musk-starship-ift-1": "SpaceX Starship integrated flight test 1",
    "zuck-beacon-lawsuit": "Facebook Beacon",
    "zuck-ipo-flash-crash": "Facebook",
    "zuck-cambridge-analytica": "Facebook–Cambridge Analytica data scandal",
    "zuck-libra-diem": "Diem (digital currency)",
    "hastings-qwikster": "Qwikster",
    "neumann-wework-s1": "WeWork",
    "kalanick-delete-uber": "Uber",
    "chesky-covid-cancellations": "Airbnb",
    "dorsey-twitter-slowdown": "Twitter",
    "ellison-google-java": "Oracle America, Inc. v. Google, Inc.",
    "ballmer-iphone": "Steve Ballmer",
    "mayer-yahoo-tumblr": "Yahoo!",
    "yang-yahoo-microsoft": "Jerry Yang (entrepreneur)",
    "holmes-theranos-wsj": "Elizabeth Holmes",
    "sbf-ftx-collapse": "FTX (company)",
    "acton-yahoo-rejection": "Brian Acton",
    "systrom-burbn-pivot": "Instagram",
    "butterfield-glitch-slack": "Slack (software)",
    "gm-bankruptcy-2009": "General Motors Chapter 11 bankruptcy",
    "chrysler-bailout-1979": "Chrysler",
    "nest-acquisition": "Nest Labs",
    "solar-city-tariff": "Tesla, Inc.",
    "better-com-2021-zoom": "Better.com",
    # Spanish/COVID flu etc. already mapped above
    "three-mile-island-1979": "Three Mile Island accident",
    "deepwater-horizon-2010": "Deepwater Horizon",
    "bhopal-1984-disaster": "Bhopal disaster",
    "covid-19-pandemic": "COVID-19 pandemic",
    "spanish-flu-1918": "Spanish flu",
    # Movies already mapped
    "john-carter-2012-bomb": "John Carter (film)",
    "cats-2019-flop": "Cats (2019 film)",
    # Real cases v2 extras
    "three-mile-island": "Three Mile Island accident",
    "chernobyl-disaster": "Chernobyl disaster",
    "fukushima-disaster": "Fukushima nuclear accident",
    "bp-deepwater-horizon": "Deepwater Horizon",
    "bhopal-disaster": "Bhopal disaster",
    "apple-maps-launch": "Apple Maps",
    "apple-maps-2022-relaunch": "Apple Maps",
    "vista-2007": "Windows Vista",
    "windows-phone-7-launch": "Windows Phone",
    "google-glass-explorer": "Google Glass",
    "apple-newton-1993": "Apple Newton",
    "hyperloop-one-shutdown": "Virgin Hyperloop",
    "better-com-2021-zoom": "Better.com",
    "solar-city-tariff": "Tesla, Inc.",
    "samsung-fold-2019": "Samsung Galaxy Fold",
    "apple-iphone-4-antenna": "IPhone 4",
    "apple-butterfly-keyboard-2015": "MacBook (2015–2019)",
    "nest-acquisition": "Nest Labs",
    "intel-itanium": "Itanium",
    "microsoft-windows-rt": "Windows RT",
    "microsoft-zune-2006": "Microsoft Zune",
    "amazon-fire-phone-2014": "Amazon Fire Phone",
    "sony-betamax-1975": "Betamax",
    "hd-dvd-vs-bluray": "HD DVD",
    "apple-lisa-1983-burial": "Apple Lisa",
}


def load_cache():
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(c):
    CACHE_FILE.write_text(json.dumps(c, indent=2))


def fetch_wiki_thumbnail(title):
    """Fetch thumbnail URL from Wikipedia REST API. Returns None on 404 or error."""
    if not title:
        return None
    safe_title = urllib.parse.quote(title.replace(' ', '_'))
    url = f'https://en.wikipedia.org/api/rest_v1/page/summary/{safe_title}'
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'people-failures/1.0 (https://desurfofficial-ship-it.github.io/people-failures/; educational project)'
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            # Prefer originalimage for higher quality (our modal shows ~160px);
            # fall back to thumbnail if original missing
            src = None
            if data.get('originalimage') and data['originalimage'].get('source'):
                src = data['originalimage']['source']
            elif data.get('thumbnail') and data['thumbnail'].get('source'):
                src = data['thumbnail']['source']
            return src
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None  # article doesn't exist
        print(f'  ERR {title}: HTTP {e.code}', file=sys.stderr)
        return None
    except Exception as e:
        print(f'  ERR {title}: {type(e).__name__}: {e}', file=sys.stderr)
        return None


def try_variants(name):
    """Try fetching with name and several variants. Returns first hit or None."""
    candidates = [name]
    # Strip parenthetical: "Steve Jobs (2015-20)" -> "Steve Jobs"
    base = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()
    if base and base != name:
        candidates.append(base)
    # Replace " — " / " - " with " "
    alt = name.replace(' — ', ' ').replace(' — ', ' ').replace(' - ', ' ')
    if alt != name:
        candidates.append(alt)
    # Strip trailing " - X" or " — X" or " (X)"
    stripped = re.sub(r'\s*[-—].*$', '', name).strip()
    if stripped and stripped != name:
        candidates.append(stripped)
    # Dedupe
    seen = set()
    candidates = [c for c in candidates if not (c in seen or seen.add(c))]
    for c in candidates:
        img = fetch_wiki_thumbnail(c)
        if img:
            return img
    return None


def main():
    cache = load_cache()
    out = {}
    n = len(REAL_CASES)
    fetched = 0
    cached_hits = 0

    for i, case in enumerate(REAL_CASES):
        cid = case[0]
        name = case[1]

        if cid in cache:
            out[cid] = cache[cid]
            if cache[cid]:
                cached_hits += 1
            continue

        # Use override if available
        title = WIKI_OVERRIDES.get(cid, name)
        img = fetch_wiki_thumbnail(title)

        if not img and cid not in WIKI_OVERRIDES:
            # Try name variants only if no explicit override
            img = try_variants(name)

        cache[cid] = img  # cache even None so we don't retry
        out[cid] = img

        if img:
            print(f'  [{i+1:3d}/{n}] OK   {cid:40s} {name[:40]}')
        else:
            print(f'  [{i+1:3d}/{n}] MISS {cid:40s} {name[:40]}')

        fetched += 1
        time.sleep(0.15)  # be polite

    save_cache(cache)
    OUT_FILE.write_text(json.dumps(out, indent=2))

    found = sum(1 for v in out.values() if v)
    print(f'\n--- Summary ---')
    print(f'Fetched:    {fetched}')
    print(f'Cache hits: {cached_hits}')
    print(f'Images:     {found}/{n} ({100*found//n}%)')
    print(f'Cache file: {CACHE_FILE}')
    print(f'Output:     {OUT_FILE}')


if __name__ == '__main__':
    main()
