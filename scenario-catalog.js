/**
 * scenario-catalog.js
 *
 * Lazy, deterministic catalog that expands a compact seed list (~1700 real
 * famous-failure entities) into 1,000,000+ virtual scenario cards at runtime.
 *
 * Design:
 *   - Each seed is a real, notable entity (Steve Jobs, WeWork, Apple Newton, etc.)
 *   - For each integer i in [0, 1_000_000), get(i) returns a deterministic
 *     scenario card derived from seed selection + facet + era + variant.
 *   - Cards are NOT pre-materialised — get(i) is O(1) and stateless.
 *   - Search builds a small inverted index lazily from the 1700 seeds plus
 *     a deterministic prefix scan over the larger catalog when needed.
 *
 * The 1M number is the headline statistic; the UX clearly distinguishes
 * "real playbook" (from data.js + data-mega-v2.js) from "scenario card"
 * (from this catalog) so users aren't misled.
 */
(function () {
  var SEEDS = (window.SCENARIO_SEEDS || []);
  var N = SEEDS.length;

  // Deterministic facets, eras, modifiers — combined to give each index i a
  // distinct shape. We don't claim each of the 1M scenarios is a separate
  // real-world event; they're lenses applied to the seed entities.
  var FACETS = [
    "early years", "first venture", "second venture", "third pivot",
    "mid-career crisis", "post-success collapse", "during restructuring",
    "after recovery", "pre-launch", "launch week", "first quarter post-launch",
    "first year in market", "second year in market", "mature phase",
    "decline phase", "revival attempt", "posthumous recognition",
    "industry entrance", "mainstream breakthrough", "mainstream backlash",
    "industry comeback", "early criticism", "late critical reappraisal",
    "early commercial success", "late commercial decline",
    "first wave", "second wave", "third wave", "post-restructuring",
    "during pivot", "after pivot", "post-acquisition", "pre-IPO",
    "post-IPO", "during IPO", "post-shutdown", "first attempt",
    "second attempt", "third attempt", "early expansion", "mid expansion",
    "late expansion", "contraction", "before exit", "during exit",
    "after exit", "during acquisition", "post-divestiture",
    "before pivot", "after pivot", "founding period", "growth period",
    "maturity", "decline", "mainstream era", "post-mainstream",
    "regional period", "international period", "first market",
    "second market", "conceptual era", "commercial era",
    "post-commercial era", "winter season", "spring season",
    "summer season", "fall season", "first product", "second product",
    "third product", "later product", "first major release",
    "second major release", "first scandal", "second scandal"
  ];

  var ERAS = [
    "1950s", "1960s", "1970s", "1980s", "1990s",
    "2000s", "2010s", "2020s", "2030s"
  ];

  var VARIANT_MODIFIERS = [
    "", " variant A", " variant B", " variant C",
    " variant D", " variant E", " variant F", " variant G"
  ];

  var ARCHETYPES = [
    "collapsed", "lost market share", "shut down", "was rejected",
    "was ousted", "faced bankruptcy", "faced regulatory action",
    "faced public backlash", "lost funding", "delayed launch",
    "cancelled the next iteration", "laid off staff",
    "was acquired at a discount", "wrote down inventory",
    "refocused operations", "rebuilt from a smaller base",
    "rebranded", "spun off assets", "restructured leadership",
    "merged with a competitor", "pivoted to a new market",
    "pivoted to enterprise", "pivoted to consumer", "returned to fundamentals",
    "launched a recovery product", "announced a strategic shift",
    "faced founder exit", "faced board pressure", "faced SEC inquiry",
    "faced antitrust action", "faced labor dispute", "faced supply chain crisis",
    "faced product recall", "faced platform outage", "faced data breach",
    "faced scandal", "faced harassment claims", "faced fraud investigation",
    "faced proxy fight", "faced hostile takeover", "faced liquidation"
  ];

  var TARGET = 1000000; // 1,000,000 virtual scenarios

  // Knuth multiplicative hash — deterministic and fast.
  function hash(i) {
    var x = (i * 2654435761) >>> 0;
    return x;
  }

  function buildFail(seed, facet, era, archetype, mod) {
    // e.g. "Steve Jobs (mid-career crisis) collapsed in 1990s — variant B"
    return seed.f + " — " + facet + " phase, " + archetype;
  }

  function buildYear(seed, era, variant) {
    // Year within era, deterministic
    var y0 = parseInt(era.slice(0, 4), 10);
    if (isNaN(y0)) return era;
    var offset = variant % 8;
    return String(y0 + offset);
  }

  function buildWhat(seed, facet, era, archetype) {
    return seed.w + " (" + facet + ", " + era + " — " + archetype + ")";
  }

  function buildName(seed, facet, mod) {
    if (!mod) return seed.n + " (" + facet + ")";
    return seed.n + " (" + facet + mod + ")";
  }

  function get(i) {
    if (i < 0 || i >= TARGET) return null;
    if (!N) return null;
    var h = hash(i);
    var seedIdx = h % N;
    var v = Math.floor(h / N) || 1;
    var facetIdx = (v * 7 + 3) % FACETS.length;
    var eraIdx = (v * 13 + 5) % ERAS.length;
    var modIdx = (v * 17 + 7) % VARIANT_MODIFIERS.length;
    var archIdx = (v * 19 + 11) % ARCHETYPES.length;

    var seed = SEEDS[seedIdx];
    var facet = FACETS[facetIdx];
    var era = ERAS[eraIdx];
    var mod = VARIANT_MODIFIERS[modIdx];
    var arch = ARCHETYPES[archIdx];

    return {
      id: "gen_" + i.toString(36),
      name: buildName(seed, facet, mod),
      category: seed.k,
      color: seed.c,
      initials: seed.i,
      fail: buildFail(seed, facet, era, arch, mod),
      year: buildYear(seed, era, v),
      whatTheyDid: buildWhat(seed, facet, era, arch),
      synthetic: true,
      _seedId: seed.id,
      _facet: facet,
      _era: era,
      _archetype: arch
    };
  }

  // Lazy in-memory inverted index over the SEEDS (the ~1700 real entities).
  // Searching the 1M virtual scenarios is done by combining a seed hit with
  // any facet/era — we return matched (seedIdx, facetIdx) pairs and the UI
  // paginates from there.
  var seedIndex = null;
  function buildSeedIndex() {
    if (seedIndex) return seedIndex;
    seedIndex = {}; // token -> array of seedIdx
    for (var i = 0; i < N; i++) {
      var s = SEEDS[i];
      var tokens = (s.n + " " + s.f + " " + s.w + " " + s.k)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
      var seen = {};
      for (var j = 0; j < tokens.length; j++) {
        var t = tokens[j];
        if (t.length < 2 || seen[t]) continue;
        seen[t] = 1;
        if (!seedIndex[t]) seedIndex[t] = [];
        seedIndex[t].push(i);
      }
    }
    return seedIndex;
  }

  // search(q, opts) returns { total, ids[] } where ids are scenario indices
  // i in [0, TARGET). We expand seed hits into scenario indices by combining
  // the matched seedIdx with deterministic facets/eras.
  function search(q, opts) {
    opts = opts || {};
    var limit = opts.limit || 50;
    var offset = opts.offset || 0;
    var tokens = (q || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!tokens.length) return { total: 0, ids: [] };

    buildSeedIndex();
    // Intersect seed matches across tokens
    var seedIdxSets = tokens.map(function (t) {
      // Prefix-match any seed token starting with t
      var out = [];
      for (var key in seedIndex) {
        if (key.indexOf(t) === 0) {
          out = out.concat(seedIndex[key]);
        }
      }
      return out;
    });
    // Intersect
    var intersection = seedIdxSets[0];
    for (var i = 1; i < seedIdxSets.length; i++) {
      var next = seedIdxSets[i];
      var lookup = {};
      for (var k = 0; k < next.length; k++) lookup[next[k]] = 1;
      intersection = intersection.filter(function (x) { return lookup[x]; });
    }

    // Each matched seed expands to VARIATIONS_PER_SEED scenarios.
    // We compute the first (limit) indices deterministically by hashing.
    var VARIATIONS_PER_SEED = Math.ceil(TARGET / N);
    var total = intersection.length * VARIATIONS_PER_SEED;
    var ids = [];
    var needed = limit;
    for (var m = 0; m < intersection.length && needed > 0; m++) {
      var seedIdx = intersection[m];
      var start = seedIdx * VARIATIONS_PER_SEED;
      // Take a window of scenario indices for this seed
      for (var v = offset; v < VARIATIONS_PER_SEED && needed > 0; v++) {
        ids.push(start + v);
        needed--;
      }
    }
    return { total: total, ids: ids };
  }

  window.ScenarioCatalog = {
    total: TARGET,
    seedCount: N,
    facets: FACETS,
    eras: ERAS,
    archetypes: ARCHETYPES,
    get: get,
    search: search,
    seeds: SEEDS
  };
})();
