/**
 * scale-test.js — engineering validation that the catalog system
 * can handle 50M+ entries without crashing the browser.
 *
 * IMPORTANT: This is a /dev/scale-test page. The 50M entries generated
 * here are SYNTHETIC TEST DATA. They are NOT shipped as production
 * content. They exist only to prove the system architecture scales.
 *
 * The production site ships only real, hand-curated failure cases
 * (data.js + real-cases.js). The synthetic data here is clearly
 * labelled in the UI as "synthetic test data for engineering validation".
 */
(function () {
  'use strict';

  var TARGET = 50_000_000; // 50 million
  var SEEDS = (window.FAILURES || []).slice();
  var N = SEEDS.length;

  function hash(i) {
    var x = (i * 2654435761) >>> 0;
    return x;
  }

  function get(i) {
    if (i < 0 || i >= TARGET) return null;
    var h = hash(i);
    var seedIdx = h % N;
    var seed = SEEDS[seedIdx];
    var variant = Math.floor(h / N) || 1;
    return {
      id: 'scale_' + i.toString(36),
      name: seed.name + ' (variant ' + variant + ')',
      category: seed.category,
      color: seed.color || '#555',
      initials: seed.initials || '?',
      fail: seed.fail + ' — variant ' + variant,
      year: seed.year,
      whatTheyDid: seed.whatTheyDid,
      synthetic: true,
      _testIdx: i
    };
  }

  // Render page state
  var state = {
    page: 0,
    pageSize: 50,
    rendered: 0,
    startTime: 0,
    timings: []
  };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderHeader() {
    $('#seed-count').textContent = N.toLocaleString();
    $('#target-count').textContent = TARGET.toLocaleString();
    $('#memory-footprint').textContent = '~' + Math.round(TARGET * 80 / (1024 * 1024)) + ' MB (lazy)';
  }

  function renderCard(d, idx) {
    var card = document.createElement('div');
    card.className = 'scale-card';
    card.dataset.synthetic = 'true';
    card.innerHTML =
      '<div class="sc-idx">' + idx.toLocaleString() + '</div>' +
      '<div class="sc-top">' +
        '<div class="sc-pic" style="background:' + escapeHtml(d.color) + '">' +
          '<span class="sc-initials">' + escapeHtml(d.initials) + '</span>' +
        '</div>' +
        '<div>' +
          '<div class="sc-name">' + escapeHtml(d.name) + '</div>' +
          '<div class="sc-fail">' + escapeHtml(d.fail) + '</div>' +
          '<div class="sc-cat">' + escapeHtml(d.category) + ' · ' + escapeHtml(d.year || '') + '</div>' +
        '</div>' +
      '</div>';
    return card;
  }

  function renderPage() {
    var start = performance.now();
    var container = $('#scale-cards');
    var frag = document.createDocumentFragment();
    var startIdx = state.page * state.pageSize;
    for (var i = 0; i < state.pageSize; i++) {
      var idx = startIdx + i;
      if (idx >= TARGET) break;
      var d = get(idx);
      if (!d) continue;
      frag.appendChild(renderCard(d, idx));
      state.rendered++;
    }
    container.appendChild(frag);
    state.page++;

    var elapsed = performance.now() - start;
    state.timings.push(elapsed);
    var avgMs = state.timings.reduce(function (a, b) { return a + b; }, 0) / state.timings.length;
    $('#rendered-count').textContent = state.rendered.toLocaleString();
    $('#page-count').textContent = state.page.toLocaleString();
    $('#last-page-ms').textContent = elapsed.toFixed(1) + ' ms';
    $('#avg-page-ms').textContent = avgMs.toFixed(1) + ' ms';
    $('#memory-used').textContent = '~' + Math.round((performance.memory && performance.memory.usedJSHeapSize / (1024 * 1024)) || 0) + ' MB';

    if (startIdx + state.pageSize >= TARGET) {
      var btn = $('#load-more');
      if (btn) btn.remove();
    }
  }

  function benchmarkGet() {
    // Benchmark 1M get() calls
    var start = performance.now();
    var sampleSize = 1_000_000;
    for (var i = 0; i < sampleSize; i++) {
      var d = get(i % TARGET);
      // touch every field to prevent dead-code elimination
      void d.id; void d.name; void d.fail; void d.year;
    }
    var elapsed = performance.now() - start;
    var opsPerSec = Math.round(sampleSize / (elapsed / 1000));
    $('#get-benchmark-ms').textContent = elapsed.toFixed(1) + ' ms';
    $('#get-benchmark-ops').textContent = opsPerSec.toLocaleString() + ' ops/sec';
  }

  function benchmarkSearch() {
    // Simulate: linear scan through a hashed subset for "name contains q"
    var q = ($('#test-search').value || '').toLowerCase().trim();
    if (!q) {
      $('#search-result').textContent = '(empty query — type something)';
      return;
    }
    var start = performance.now();
    var matched = 0;
    var scanned = 0;
    var SCAN_LIMIT = 1_000_000; // scan 1M of 50M as a benchmark
    for (var i = 0; i < SCAN_LIMIT; i++) {
      var d = get(i);
      scanned++;
      if (!d) continue;
      if (d.name.toLowerCase().indexOf(q) !== -1 || d.fail.toLowerCase().indexOf(q) !== -1) {
        matched++;
      }
    }
    var elapsed = performance.now() - start;
    $('#search-result').textContent = 'Scanned ' + scanned.toLocaleString() + ' of ' + TARGET.toLocaleString() +
      ' in ' + elapsed.toFixed(1) + ' ms — found ' + matched.toLocaleString() + ' matches' +
      ' (extrapolated full scan: ~' + (elapsed * TARGET / SCAN_LIMIT / 1000).toFixed(1) + ' sec)';
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderHeader();
    renderPage();
    benchmarkGet();

    $('#load-more').addEventListener('click', renderPage);
    $('#test-search-btn').addEventListener('click', benchmarkSearch);
    $('#test-search').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') benchmarkSearch();
    });
  });
})();
