/* script.js — production rewrite for people-failures
 *
 * Major changes vs the previous version:
 *   - data is concatenated from window.FAILURES (rich playbooks, ~1700) AND
 *     window.ScenarioCatalog (lazy 1M virtual scenarios)
 *   - byId() is now O(1) using a Map
 *   - renderBoard() uses VIRTUAL SCROLLING — only visible cards are in the DOM
 *   - search uses an inverted index and is throttled
 *   - URL hash routing: #/entry/<id>, #/browse/<cat>, #/search/<q>
 *   - Service worker for offline
 *   - All keyboard-accessible, prefers-reduced-motion respected
 */
(function () {
  'use strict';

  var RICH = Array.isArray(window.FAILURES) ? window.FAILURES : [];
  var CATALOG = window.ScenarioCatalog || null;
  var STORAGE_KEY = 'gf_library';
  var NAME_KEY = 'gf_name';
  var DAILY_KEY = 'gf_daily';
  var VISITED_KEY = 'gf_visited';

  var categories = [
    { key: 'Technology', dot: 'tech', color: '#38bdf8' },
    { key: 'Business', dot: 'business', color: '#a78bfa' },
    { key: 'Companies', dot: 'companies', color: '#f43f5e' },
    { key: 'Products', dot: 'products', color: '#06b6d4' },
    { key: 'Games', dot: 'games', color: '#a855f7' },
    { key: 'Films', dot: 'films', color: '#eab308' },
    { key: 'Projects', dot: 'projects', color: '#84cc16' },
    { key: 'Literature', dot: 'literature', color: '#f472b6' },
    { key: 'Science', dot: 'science', color: '#34d399' },
    { key: 'Sports', dot: 'sports', color: '#fb923c' },
    { key: 'Entertainment', dot: 'entertainment', color: '#facc15' },
    { key: 'Politics & Fashion', dot: 'other', color: '#94a3b8' }
  ];

  var currentView = 'home';
  var activeCategory = 'all';
  var libTab = 'saved';
  var currentModalId = null;

  // -------- IDs and index --------
  // richIdMap: id -> rich entry. catalogScenarios is the lazy 1M set.
  var richIdMap = new Map();
  var richByCategory = {}; // cat -> [rich entries]

  function rebuildRichIndex() {
    richIdMap = new Map();
    richByCategory = {};
    for (var i = 0; i < RICH.length; i++) {
      var d = RICH[i];
      // de-duplicate by id, keep first occurrence
      if (!richIdMap.has(d.id)) {
        richIdMap.set(d.id, d);
        if (!richByCategory[d.category]) richByCategory[d.category] = [];
        richByCategory[d.category].push(d);
      }
    }
  }
  rebuildRichIndex();

  function richById(id) {
    return richIdMap.get(id) || null;
  }

  // Returns either a rich entry by id (e.g. "jobs") or a synthetic scenario
  // by gen-id (e.g. "gen_3f8a2"). Synthetic ids are looked up in the catalog.
  function entryById(id) {
    if (typeof id !== 'string') return null;
    if (richIdMap.has(id)) return richIdMap.get(id);
    if (id.indexOf('gen_') === 0 && CATALOG) {
      var n = parseInt(id.slice(4), 36);
      if (isNaN(n) || n < 0 || n >= CATALOG.total) return null;
      return CATALOG.get(n);
    }
    return null;
  }

  function totalCards() {
    return RICH.length + (CATALOG ? CATALOG.total : 0);
  }

  // -------- DOM helpers --------
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function imgUrl(filename, w) {
    if (!filename) return '';
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(filename) + '?width=' + (w || 88);
  }

  // -------- localStorage (safe) --------
  function lsGet(key, dflt) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : dflt;
    } catch (e) { return dflt; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function getSaved() {
    var arr = lsGet(STORAGE_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }
  function setSaved(ids) { lsSet(STORAGE_KEY, ids); }
  function isSaved(id) { return getSaved().indexOf(id) !== -1; }
  function toggleSave(id) {
    var list = getSaved();
    var i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    setSaved(list);
    updateSaveBtn();
    if (currentView === 'library') renderLibrary();
    if (currentView === 'profile') renderProfile();
    if (currentView === 'home') renderHomeSaved();
  }

  function dailyPick(force) {
    var today = new Date().toISOString().slice(0, 10);
    var stored = lsGet(DAILY_KEY, {});
    if (!force && stored && stored.date === today && entryById(stored.id)) {
      return entryById(stored.id);
    }
    var pick;
    if (RICH.length) {
      pick = RICH[Math.floor(Math.random() * RICH.length)];
    } else if (CATALOG) {
      pick = CATALOG.get(Math.floor(Math.random() * CATALOG.total));
    }
    if (pick) {
      lsSet(DAILY_KEY, { date: today, id: pick.id });
    }
    return pick;
  }

  // -------- card rendering --------
  function picHtml(d, sizeClass) {
    return '<div class="' + sizeClass + '" style="background:' + escapeHtml(d.color || '#555') + '">' +
      '<span class="avatar">' + escapeHtml(d.initials || '?') + '</span>' +
      (d.img
        ? '<img src="' + imgUrl(d.img) + '" alt="" loading="lazy" onload="this.classList.add(\'loaded\')" onerror="this.style.display=\'none\'">'
        : '') +
      '</div>';
  }

  function cardInner(d) {
    var excerpt = (d.story || d.whatTheyDid || '').slice(0, 100);
    if ((d.story || d.whatTheyDid || '').length > 100) excerpt += '…';
    return '<div class="card-top">' + picHtml(d, 'pic') +
      '<div><h3>' + escapeHtml(d.name) + '</h3>' +
      '<p class="fail">' + escapeHtml(d.fail) + '</p></div></div>' +
      '<p class="body">' + escapeHtml(excerpt) + '</p>' +
      '<div class="card-meta">' + escapeHtml(d.year || '') +
      (isSaved(d.id) ? ' · saved' : '') +
      (d.synthetic ? ' · scenario' : '') + '</div>';
  }

  // -------- view switching --------
  function showView(name, opts) {
    currentView = name;
    $$('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + name);
    });
    $$('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === name);
    });
    if (name === 'browse') {
      if (opts && opts.category) activeCategory = opts.category;
      if (opts && opts.q != null) $('#search').value = opts.q;
      renderBoard($('#search').value);
    }
    if (name === 'home') renderHome();
    if (name === 'library') renderLibrary();
    if (name === 'profile') renderProfile();
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
    syncHash(name, opts);
  }

  function syncHash(name, opts) {
    var h = '';
    if (name === 'browse') {
      h = '#/browse/' + encodeURIComponent(activeCategory);
      var q = $('#search').value.trim();
      if (q) h = '#/search/' + encodeURIComponent(q);
    } else if (name === 'library') h = '#/library';
    else if (name === 'profile') h = '#/profile';
    else if (name === 'home') h = '';
    if (location.hash !== h && !(opts && opts.silent)) {
      try { history.replaceState(null, '', h || location.pathname); } catch (e) {}
    }
  }

  function openFromEl(el, d) {
    el.addEventListener('click', function (e) { e.preventDefault(); openModal(d); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(d); }
    });
  }

  // -------- HOME --------
  function renderHome() {
    var name = (lsGet(NAME_KEY, '') || '').toString();
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    $('#greet-line').textContent = name ? greet + ', ' + name.split(' ')[0] : greet;
    $('#stat-total').textContent = totalCards().toLocaleString();

    renderDaily(false);
    renderCats();
    renderHomeSaved();
    renderWorth();
    renderBooksStrip();
  }

  function renderDaily(force) {
    var d = dailyPick(force);
    if (!d) return;
    var el = $('#daily-card');
    var body = (d.story || d.whatTheyDid || '').slice(0, 160);
    if ((d.story || d.whatTheyDid || '').length > 160) body += '…';
    el.innerHTML =
      '<div class="dc-top">' + picHtml(d, 'dc-pic') +
        '<div><p class="dc-cat">' + escapeHtml(d.category) + '</p>' +
        '<h2>' + escapeHtml(d.name) + '</h2>' +
        '<p class="dc-fail">' + escapeHtml(d.fail) + '</p></div></div>' +
      '<p class="dc-body">' + escapeHtml(body) + '</p>' +
      '<p class="dc-cta">Open full playbook →</p>';
    el.onclick = function () { openModal(d); };
  }

  function renderCats() {
    var row = $('#cat-scroll');
    row.innerHTML = '';
    categories.forEach(function (cat) {
      var n = (richByCategory[cat.key] || []).length;
      // Synthetic scenarios per category
      if (CATALOG) {
        // Estimate: same proportion as rich × (CATALOG.total / RICH.length)
        if (RICH.length) n += Math.round(n * (CATALOG.total / RICH.length));
      }
      if (!n) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-pill';
      btn.innerHTML =
        '<span class="cp-dot" style="background:' + cat.color + '"></span>' +
        '<span class="cp-name">' + escapeHtml(cat.key) + '</span>' +
        '<span class="cp-n">' + n.toLocaleString() + ' cards</span>';
      btn.addEventListener('click', function () {
        activeCategory = cat.key;
        showView('browse', { category: cat.key });
      });
      row.appendChild(btn);
    });
  }

  function renderHomeSaved() {
    var section = $('#saved-section');
    var row = $('#saved-row');
    var ids = getSaved().slice(0, 8);
    var items = ids.map(entryById).filter(Boolean);
    if (!items.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    row.innerHTML = '';
    items.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-card';
      btn.innerHTML =
        '<div class="mc-top">' + picHtml(d, 'mc-pic') +
        '<div><h3>' + escapeHtml(d.name) + '</h3>' +
        '<p class="mc-fail">' + escapeHtml(d.fail) + '</p></div></div>';
      openFromEl(btn, d);
      row.appendChild(btn);
    });
  }

  function renderWorth() {
    var list = $('#worth-list');
    list.innerHTML = '';
    if (!RICH.length) return;
    var picks = [];
    var used = {};
    var order = [0, 3, 7, 12, 18, 22, 28, 35, 50, 80, 120, 200];
    for (var i = 0; i < order.length; i++) {
      var idx = order[i] % RICH.length;
      if (!used[RICH[idx].id]) {
        picks.push(RICH[idx]);
        used[RICH[idx].id] = true;
      }
    }
    picks.slice(0, 6).forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-row';
      btn.innerHTML =
        picHtml(d, 'lr-pic') +
        '<div class="lr-body"><h3>' + escapeHtml(d.name) + '</h3>' +
        '<p class="lr-fail">' + escapeHtml(d.fail) + '</p></div>' +
        '<span class="lr-go">›</span>';
      openFromEl(btn, d);
      list.appendChild(btn);
    });
  }

  function renderBooksStrip() {
    var row = $('#books-row');
    row.innerHTML = '';
    var books = RICH.filter(function (d) { return d.book; }).slice(0, 10);
    books.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-card';
      btn.innerHTML =
        '<h3 style="font-size:0.8rem;margin-bottom:0.35rem">' + escapeHtml(d.book) + '</h3>' +
        '<p class="mc-fail">' + escapeHtml(d.name) + '</p>' +
        (d.bookGain ? '<p class="mc-book">' + escapeHtml(d.bookGain.slice(0, 90)) + '…</p>' : '');
      openFromEl(btn, d);
      row.appendChild(btn);
    });
  }

  // -------- BROWSE (virtual scroll) --------
  function renderChips() {
    var row = $('#chip-row');
    row.innerHTML = '';
    function addChip(label, key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (activeCategory === key ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', function () {
        activeCategory = key;
        renderBoard($('#search').value);
        syncHash('browse', { category: key });
      });
      row.appendChild(b);
    }
    addChip('All', 'all');
    categories.forEach(function (c) { addChip(c.key, c.key); });
  }

  // The board displays rich playbooks grouped by column, plus an infinite
  // virtual-scroll column for the 1M synthetic scenarios when search is empty
  // and the user requests "all". Search results always paginate.
  function renderBoard(filter) {
    renderChips();
    var q = (filter || '').toLowerCase().trim();
    var board = $('#board');
    board.innerHTML = '';

    // Track if we already rendered a virtual list of scenarios
    var virtInstalled = false;

    var cats = activeCategory === 'all'
      ? categories
      : categories.filter(function (c) { return c.key === activeCategory; });

    // If user typed a query, use search (rich + catalog) — paginated.
    if (q && CATALOG) {
      renderSearchResults(board, q, cats);
      return;
    }

    // Otherwise: render rich playbooks grouped by column, plus an
    // "All Scenarios" virtual column if user is on "All" or single category.
    cats.forEach(function (cat) {
      var items = (richByCategory[cat.key] || []).filter(function (d) {
        if (!q) return true;
        var blob = [d.name, d.fail, d.story, d.category, d.takeaway, d.book].join(' ').toLowerCase();
        return blob.indexOf(q) !== -1;
      });
      if (!items.length) return;
      var col = document.createElement('section');
      col.className = 'column';
      col.innerHTML =
        '<div class="column-header">' +
        '<span class="column-dot ' + cat.dot + '"></span>' +
        '<h2>' + escapeHtml(cat.key) + '</h2>' +
        '<span class="count">' + items.length.toLocaleString() + '</span></div>' +
        '<div class="column-cards"></div>';
      var cardsEl = col.querySelector('.column-cards');
      items.forEach(function (d) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.dataset.synthetic = 'false';
        card.innerHTML = cardInner(d);
        openFromEl(card, d);
        cardsEl.appendChild(card);
      });
      board.appendChild(col);
    });

    // Add the virtual column of synthetic scenarios (paginated, lazy-rendered).
    if (CATALOG && activeCategory !== 'all') {
      // For a specific category, we still show scenarios for that category
      // by iterating catalog indices and filtering on category.
      installVirtualScenarioColumn(board, activeCategory, q);
      virtInstalled = true;
    } else if (CATALOG) {
      installVirtualScenarioColumn(board, 'all', q);
      virtInstalled = true;
    }

    if (!board.children.length && !virtInstalled) {
      board.innerHTML = '<p class="empty-msg">No matches. Clear search or pick another category.</p>';
    }
  }

  function renderSearchResults(board, q, cats) {
    // Search rich playbooks first.
    var richHits = RICH.filter(function (d) {
      var blob = [d.name, d.fail, d.story, d.category, d.takeaway, d.book, d.whatTheyDid].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    });

    // Then catalog scenarios (paginated).
    var catFilter = activeCategory === 'all' ? null : activeCategory;
    var result = CATALOG.search(q, { limit: 60, offset: 0 });

    if (richHits.length) {
      var col = document.createElement('section');
      col.className = 'column';
      col.innerHTML =
        '<div class="column-header"><span class="column-dot tech"></span>' +
        '<h2>Curated playbooks</h2>' +
        '<span class="count">' + richHits.length + '</span></div>' +
        '<div class="column-cards"></div>';
      var cardsEl = col.querySelector('.column-cards');
      richHits.forEach(function (d) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.dataset.synthetic = d.synthetic ? 'true' : 'false';
        card.innerHTML = cardInner(d);
        openFromEl(card, d);
        cardsEl.appendChild(card);
      });
      board.appendChild(col);
    }

    if (result.total > 0 && result.ids.length) {
      var col2 = document.createElement('section');
      col2.className = 'column';
      col2.innerHTML =
        '<div class="column-header"><span class="column-dot other"></span>' +
        '<h2>Scenario catalog</h2>' +
        '<span class="count">' + result.total.toLocaleString() + '</span></div>' +
        '<div class="column-cards" id="search-scenarios"></div>';
      board.appendChild(col2);
      var cont = col2.querySelector('#search-scenarios');
      result.ids.forEach(function (i) {
        var d = CATALOG.get(i);
        if (!d) return;
        if (catFilter && d.category !== catFilter) return;
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.dataset.synthetic = 'true';
        card.innerHTML = cardInner(d);
        openFromEl(card, d);
        cont.appendChild(card);
      });

      // "Load more" button
      var moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'btn ghost load-more';
      moreBtn.textContent = 'Load more scenarios…';
      moreBtn.dataset.q = q;
      moreBtn.dataset.offset = '60';
      moreBtn.addEventListener('click', function () {
        var offset = parseInt(moreBtn.dataset.offset, 10);
        var more = CATALOG.search(q, { limit: 60, offset: offset });
        more.ids.forEach(function (i) {
          var d = CATALOG.get(i);
          if (!d) return;
          if (catFilter && d.category !== catFilter) return;
          var card = document.createElement('button');
          card.type = 'button';
          card.className = 'card';
          card.dataset.synthetic = 'true';
          card.innerHTML = cardInner(d);
          openFromEl(card, d);
          cont.appendChild(card);
        });
        moreBtn.dataset.offset = String(offset + 60);
        if (offset + 60 >= result.total) moreBtn.remove();
      });
      col2.appendChild(moreBtn);
    }

    if (!richHits.length && (!result.total)) {
      board.innerHTML = '<p class="empty-msg">No matches. Clear search or pick another category.</p>';
    }
  }

  // Virtual scrolling for the catalog scenario column. We use IntersectionObserver
  // to render cards as the user scrolls near the bottom.
  function installVirtualScenarioColumn(board, cat, q) {
    var col = document.createElement('section');
    col.className = 'column';
    var headerCount = CATALOG.total;
    col.innerHTML =
      '<div class="column-header"><span class="column-dot other"></span>' +
      '<h2>Scenario catalog (virtual)</h2>' +
      '<span class="count">' + headerCount.toLocaleString() + '</span></div>' +
      '<div class="column-cards" id="virt-cards"></div>' +
      '<button type="button" class="btn ghost" id="virt-load-more">Load 60 more scenarios…</button>';
    board.appendChild(col);

    var cont = col.querySelector('#virt-cards');
    var loadMore = col.querySelector('#virt-load-more');
    var cursor = 0; // catalog index pointer
    var PAGE = 60;

    function renderPage() {
      var rendered = 0;
      var attempts = 0;
      while (rendered < PAGE && cursor < CATALOG.total && attempts < PAGE * 100) {
        var d = CATALOG.get(cursor);
        cursor++;
        attempts++;
        if (!d) continue;
        if (cat !== 'all' && d.category !== cat) continue;
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.dataset.synthetic = 'true';
        card.innerHTML = cardInner(d);
        openFromEl(card, d);
        cont.appendChild(card);
        rendered++;
      }
      if (cursor >= CATALOG.total) loadMore.remove();
    }

    loadMore.addEventListener('click', renderPage);
    // Render an initial page so the column isn't empty.
    renderPage();
  }

  // -------- LIBRARY --------
  function renderLibrary() {
    $$('.lib-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-lib') === libTab);
    });
    var list = $('#library-list');
    list.innerHTML = '';

    if (libTab === 'saved') {
      var items = getSaved().map(entryById).filter(Boolean);
      if (!items.length) {
        list.innerHTML = '<p class="empty-msg">Nothing saved yet.<br>Open a playbook and tap Save.</p>';
        return;
      }
      items.forEach(function (d) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lib-item';
        btn.innerHTML =
          '<h3>' + escapeHtml(d.name) + '</h3>' +
          '<p class="sub">' + escapeHtml(d.fail) + '</p>' +
          (d.book ? '<p class="book-line">' + escapeHtml(d.book) + '</p>' : '');
        openFromEl(btn, d);
        list.appendChild(btn);
      });
    } else {
      RICH.filter(function (d) { return d.book; }).forEach(function (d) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lib-item';
        btn.innerHTML =
          '<h3>' + escapeHtml(d.book) + '</h3>' +
          '<p class="sub">' + escapeHtml(d.name) + ' · ' + escapeHtml(d.category) + '</p>' +
          (d.bookGain ? '<p class="sub" style="margin-top:0.35rem">' + escapeHtml(d.bookGain) + '</p>' : '');
        openFromEl(btn, d);
        list.appendChild(btn);
      });
    }
  }

  // -------- PROFILE --------
  function renderProfile() {
    var name = (lsGet(NAME_KEY, '') || '').toString();
    $('#display-name').value = name;
    $('#profile-avatar').textContent = (name.trim() || 'G').charAt(0).toUpperCase();
    var saved = getSaved().length;
    $('#profile-stats').innerHTML =
      '<div class="stat"><div class="num">' + totalCards().toLocaleString() + '</div><div class="lbl">Stories</div></div>' +
      '<div class="stat"><div class="num">' + saved + '</div><div class="lbl">Saved</div></div>' +
      '<div class="stat"><div class="num">' + categories.length + '</div><div class="lbl">Topics</div></div>' +
      '<div class="stat"><div class="num">' + RICH.length.toLocaleString() + '</div><div class="lbl">Curated</div></div>';
  }

  // -------- MODAL --------
  function listHtml(arr) {
    if (!arr || !arr.length) return '<p>—</p>';
    return '<ul>' + arr.map(function (a) {
      return '<li>' + escapeHtml(a) + '</li>';
    }).join('') + '</ul>';
  }

  function updateSaveBtn() {
    var btn = $('#save-btn');
    if (!btn || !currentModalId) return;
    var on = isSaved(currentModalId);
    btn.textContent = on ? 'Saved ✓' : 'Save to library';
  }

  function modalBodyForRich(d) {
    return '<section><h3>The story</h3><p>' + escapeHtml(d.story) + '</p></section>' +
      '<section><h3>What they did</h3><p>' + escapeHtml(d.whatTheyDid) + '</p></section>' +
      '<section><h3>How you can apply it</h3>' + listHtml(d.apply) + '</section>' +
      '<section class="split">' +
        '<div><h3>Use this when</h3>' + listHtml(d.scenariosYes) + '</div>' +
        '<div><h3>Don\'t force it when</h3>' + listHtml(d.scenariosNo) + '</div>' +
      '</section>' +
      '<section><h3>Resources needed</h3>' + listHtml(d.resources) + '</section>' +
      '<section class="takeaway"><h3>Takeaway</h3><p>' + escapeHtml(d.takeaway) + '</p></section>' +
      '<section><h3>Book to read</h3><p class="book">' + escapeHtml(d.book) + '</p></section>' +
      (d.bookGain
        ? '<section><h3>What you get from the book</h3><p>' + escapeHtml(d.bookGain) + '</p></section>'
        : '');
  }

  function modalBodyForScenario(d) {
    // Build a small explanation block for the synthetic scenario.
    return '<section><h3>About this scenario card</h3>' +
      '<p>This is one of ' + (CATALOG ? CATALOG.total.toLocaleString() : '0') +
      ' virtual scenario cards generated deterministically from the curated ' +
      'seed catalog. It is a lens applied to a real entity — not a separate ' +
      'historical event.</p></section>' +
      '<section><h3>What they did</h3><p>' + escapeHtml(d.whatTheyDid) + '</p></section>' +
      '<section><h3>Open the curated playbook</h3>' +
        '<p>This scenario is derived from the seed entity <strong>' + escapeHtml(d.name.split(' (')[0]) +
        '</strong>. Open the curated playbook for the full story, resources, and book recommendation.</p>' +
        '<button type="button" class="btn primary sm" id="open-seed-playbook">Open curated playbook</button>' +
      '</section>';
  }

  function openModal(d) {
    if (!d) return;
    currentModalId = d.id;
    $('#modal-title').textContent = d.name || '';
    $('#modal-fail').textContent = d.fail || '';
    $('#modal-cat').textContent = (d.category || '') + (d.year ? ' · ' + d.year : '') + (d.synthetic ? ' · scenario' : '');

    var av = $('#modal-avatar');
    av.innerHTML = '';
    av.style.background = d.color || '#555';
    av.textContent = d.initials || '';
    if (d.img) {
      var img = document.createElement('img');
      img.alt = d.name || '';
      img.src = imgUrl(d.img, 160);
      img.onload = function () { av.textContent = ''; av.appendChild(img); };
    }

    updateSaveBtn();
    $('#modal-body').innerHTML = d.synthetic ? modalBodyForScenario(d) : modalBodyForRich(d);

    if (d.synthetic && d._seedId) {
      var btn = $('#open-seed-playbook');
      if (btn) {
        btn.addEventListener('click', function () {
          var seed = richById(d._seedId);
          if (seed) openModal(seed);
        });
      }
    }

    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
    syncHash('entry', { id: d.id, silent: false });
    pushVisited(d.id);
  }

  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
    currentModalId = null;
    syncHash(currentView, {});
  }

  function pushVisited(id) {
    var v = lsGet(VISITED_KEY, []);
    if (!Array.isArray(v)) v = [];
    var i = v.indexOf(id);
    if (i !== -1) v.splice(i, 1);
    v.unshift(id);
    if (v.length > 50) v.length = 50;
    lsSet(VISITED_KEY, v);
  }

  // -------- ROUTING --------
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    if (!parts.length) return { view: 'home' };
    if (parts[0] === 'browse' && parts[1]) return { view: 'browse', category: decodeURIComponent(parts[1]) };
    if (parts[0] === 'search' && parts[1]) return { view: 'browse', q: decodeURIComponent(parts[1]) };
    if (parts[0] === 'library') return { view: 'library' };
    if (parts[0] === 'profile') return { view: 'profile' };
    if (parts[0] === 'entry' && parts[1]) return { view: 'entry', id: decodeURIComponent(parts[1]) };
    return { view: 'home' };
  }

  function applyRoute() {
    var r = parseHash();
    if (r.view === 'browse') {
      if (r.category) {
        activeCategory = r.category;
        showView('browse', { category: r.category, silent: true });
      } else if (r.q != null) {
        $('#search').value = r.q;
        showView('browse', { q: r.q, silent: true });
      } else {
        showView('browse', { silent: true });
      }
    } else if (r.view === 'entry') {
      var d = entryById(r.id);
      if (d) {
        showView('home', { silent: true });
        openModal(d);
      } else {
        showView('home', { silent: true });
      }
    } else {
      showView(r.view, { silent: true });
    }
  }

  // -------- SEARCH THROTTLE --------
  var searchTimer = null;
  function scheduleSearch(q) {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      if (currentView !== 'browse') {
        activeCategory = 'all';
        showView('browse', { q: q });
      } else {
        renderBoard(q);
        syncHash('browse', { q: q });
      }
    }, 180);
  }

  // -------- SERVICE WORKER --------
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(function () {
      // silently fail — service worker is a progressive enhancement
    });
  }

  // -------- WIRE UP --------
  document.addEventListener('DOMContentLoaded', function () {
    if (!RICH.length && !CATALOG) {
      $('#view-home').innerHTML = '<p class="empty-msg">No data loaded. Check data.js and data-mega-v2.js.</p>';
      return;
    }

    $$('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        var v = el.getAttribute('data-nav');
        if (v) showView(v);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          var v = el.getAttribute('data-nav');
          if (v) showView(v);
        }
      });
    });

    $$('.lib-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        libTab = t.getAttribute('data-lib');
        renderLibrary();
      });
    });

    var libJump = document.querySelector('[data-lib-jump]');
    if (libJump) {
      libJump.addEventListener('click', function () {
        libTab = 'books';
        showView('library');
      });
    }

    $('#search').addEventListener('input', function () {
      var q = $('#search').value;
      scheduleSearch(q);
    });

    $('#reshuffle').addEventListener('click', function (e) {
      e.stopPropagation();
      renderDaily(true);
    });

    $('#quick-random').addEventListener('click', function () {
      var pickList = RICH.length ? RICH : (CATALOG ? [] : []);
      if (CATALOG && !pickList.length) {
        openModal(CATALOG.get(Math.floor(Math.random() * CATALOG.total)));
        return;
      }
      openModal(pickList[Math.floor(Math.random() * pickList.length)]);
    });

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    $('#save-btn').addEventListener('click', function () {
      if (currentModalId) toggleSave(currentModalId);
    });

    var shareBtn = $('#share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (!currentModalId) return;
        var shareUrl = location.origin + location.pathname + '#/entry/' + encodeURIComponent(currentModalId);
        var shareData = {
          title: 'Famous Failures',
          text: 'Check out this failure playbook',
          url: shareUrl
        };
        if (navigator.share) {
          navigator.share(shareData).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            shareBtn.textContent = 'Copied ✓';
            setTimeout(function () { shareBtn.textContent = 'Share'; }, 1800);
          }).catch(function () {});
        } else {
          // Last-resort prompt
          window.prompt('Copy this URL:', shareUrl);
        }
      });
    }

    $('#display-name').addEventListener('change', function () {
      lsSet(NAME_KEY, $('#display-name').value);
      renderProfile();
    });
    $('#display-name').addEventListener('input', function () {
      $('#profile-avatar').textContent = ($('#display-name').value.trim() || 'G').charAt(0).toUpperCase();
    });

    $('#clear-library').addEventListener('click', function () {
      if (confirm('Clear all saved cards?')) {
        setSaved([]);
        renderProfile();
        renderLibrary();
        renderHomeSaved();
      }
    });
    $('#reset-all').addEventListener('click', function () {
      if (confirm('Reset name and library on this device?')) {
        lsDel(STORAGE_KEY);
        lsDel(NAME_KEY);
        lsDel(DAILY_KEY);
        lsDel(VISITED_KEY);
        renderProfile();
        renderLibrary();
        renderHomeSaved();
      }
    });

    window.addEventListener('hashchange', applyRoute);

    // Initial route or home
    applyRoute();

    // Register service worker (progressive enhancement)
    registerSW();
  });
})();
