/* script.js — v2.0 production rewrite
 *
 * Major changes vs v1.0:
 *   - REAL CASES ONLY — no synthetic catalog. data.js + real-cases.js
 *   - Light/dark theme toggle (respects prefers-color-scheme + localStorage override)
 *   - Toast notifications for save/share/copy actions
 *   - Recently-viewed section on home (last 12 visited cards)
 *   - Keyboard shortcuts: `/` focuses search, `g h/b/l/p` navigates, `Esc` closes modal
 *   - Animated stat count-up on home
 *   - Smooth modal transitions (transform/opacity instead of display:none)
 *   - 404 page for invalid entry IDs (URL routing)
 *   - Skip-to-content link for screen readers
 *   - Reading-time estimate in modal
 *   - Theme toggle button (top-right)
 *   - Search keyboard hint ("/") in search bar
 *
 * For engineering validation of 50M+ capacity, see /scale-test.html
 * (separate page, clearly labelled as synthetic test data).
 */
(function () {
  'use strict';

  var RICH = Array.isArray(window.FAILURES) ? window.FAILURES : [];
  var STORAGE_KEY = 'gf_library';
  var NAME_KEY = 'gf_name';
  var DAILY_KEY = 'gf_daily';
  var VISITED_KEY = 'gf_visited';
  var THEME_KEY = 'gf_theme';

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

  // -------- Indexes --------
  var richIdMap = new Map();
  var richByCategory = {};

  function rebuildRichIndex() {
    richIdMap = new Map();
    richByCategory = {};
    for (var i = 0; i < RICH.length; i++) {
      var d = RICH[i];
      if (!richIdMap.has(d.id)) {
        richIdMap.set(d.id, d);
        if (!richByCategory[d.category]) richByCategory[d.category] = [];
        richByCategory[d.category].push(d);
      }
    }
  }
  rebuildRichIndex();

  function entryById(id) {
    return richIdMap.get(id) || null;
  }

  function totalCards() { return RICH.length; }

  // -------- DOM helpers --------
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function imgUrl(filename, w) {
    if (!filename) return '';
    // If it's already a full URL (e.g., from Wikipedia/Wikimedia upload.wikimedia.org),
    // use as-is — the API returns ready-to-use thumbnail URLs.
    if (/^https?:\/\//.test(filename)) return filename;
    // Otherwise treat as a Commons filename and build the Special:FilePath URL.
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(filename) + '?width=' + (w || 88);
  }

  // -------- localStorage --------
  function lsGet(key, dflt) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : dflt; }
    catch (e) { return dflt; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function lsGetRaw(key, dflt) {
    try { return localStorage.getItem(key) || dflt; } catch (e) { return dflt; }
  }
  function lsSetRaw(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  function getSaved() { var arr = lsGet(STORAGE_KEY, []); return Array.isArray(arr) ? arr : []; }
  function setSaved(ids) { lsSet(STORAGE_KEY, ids); }
  function isSaved(id) { return getSaved().indexOf(id) !== -1; }

  function toggleSave(id) {
    var list = getSaved(); var i = list.indexOf(id);
    if (i === -1) { list.push(id); toast('Saved to library', 'success'); }
    else { list.splice(i, 1); toast('Removed from library'); }
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
    if (!RICH.length) return null;
    var pick = RICH[Math.floor(Math.random() * RICH.length)];
    lsSet(DAILY_KEY, { date: today, id: pick.id });
    return pick;
  }

  // -------- Toast notifications --------
  function ensureToastStack() {
    var stack = $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, type) {
    var stack = ensureToastStack();
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add('fade-out');
      setTimeout(function () { el.remove(); }, 250);
    }, 2400);
  }

  // -------- Theme --------
  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function initTheme() {
    var stored = lsGetRaw(THEME_KEY, null);
    applyTheme(stored);
    // Theme toggle button
    var toggle = $('.theme-toggle');
    if (toggle) {
      updateThemeToggleIcon(toggle);
      toggle.addEventListener('click', function () {
        var current = lsGetRaw(THEME_KEY, null);
        var next = current === 'dark' ? 'light' : 'dark';
        lsSetRaw(THEME_KEY, next);
        applyTheme(next);
        updateThemeToggleIcon(toggle);
      });
    }
  }

  function updateThemeToggleIcon(btn) {
    var current = lsGetRaw(THEME_KEY, null);
    var effective = current || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    btn.textContent = effective === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-label', 'Switch to ' + (effective === 'dark' ? 'light' : 'dark') + ' mode');
  }

  // -------- Card rendering --------
  function picHtml(d, sizeClass) {
    return '<div class="' + sizeClass + '" style="background:' + escapeHtml(d.color || '#555') + '">' +
      '<span class="avatar">' + escapeHtml(d.initials || '?') + '</span>' +
      (d.img ? '<img src="' + imgUrl(d.img) + '" alt="" loading="lazy" onload="this.classList.add(\'loaded\')" onerror="this.style.display=\'none\'">' : '') +
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
      (d.real ? ' · real' : '') + '</div>';
  }

  // -------- View switching --------
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

    animateCountUp($('#stat-total'), totalCards());

    renderDaily(false);
    renderCats();
    renderHomeSaved();
    renderRecentlyViewed();
    renderWorth();
    renderBooksStrip();
  }

  function animateCountUp(el, target) {
    if (!el) return;
    var start = parseInt(el.getAttribute('data-count') || '0', 10);
    var duration = 800;
    var startTime = performance.now();
    function step(now) {
      var t = Math.min((now - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      var value = Math.round(start + (target - start) * eased);
      el.textContent = value.toLocaleString();
      if (t < 1) requestAnimationFrame(step);
      else el.setAttribute('data-count', String(target));
    }
    requestAnimationFrame(step);
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
      if (!n) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-pill';
      btn.innerHTML =
        '<span class="cp-dot" style="background:' + cat.color + '"></span>' +
        '<span class="cp-name">' + escapeHtml(cat.key) + '</span>' +
        '<span class="cp-n">' + n + ' cards</span>';
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
    if (!items.length) { section.hidden = true; return; }
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

  function renderRecentlyViewed() {
    var section = $('#recently-viewed-section');
    var row = $('#recently-viewed-row');
    if (!section || !row) return;
    var visited = lsGet(VISITED_KEY, []);
    if (!Array.isArray(visited) || !visited.length) { section.hidden = true; return; }
    var items = visited.slice(0, 12).map(entryById).filter(Boolean);
    if (!items.length) { section.hidden = true; return; }
    section.hidden = false;
    row.innerHTML = '';
    items.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-card';
      btn.innerHTML =
        '<div class="mc-top">' + picHtml(d, 'mc-pic') +
        '<div><h3 style="font-size:0.85rem">' + escapeHtml(d.name) + '</h3>' +
        '<p class="mc-fail" style="font-size:0.7rem">' + escapeHtml(d.fail.slice(0, 40)) + '…</p></div></div>';
      openFromEl(btn, d);
      row.appendChild(btn);
    });
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
    var books = RICH.filter(function (d) { return d.book && d.book !== '—'; }).slice(0, 10);
    books.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-card';
      btn.innerHTML =
        '<h3 style="font-size:0.8rem;margin-bottom:0.35rem">' + escapeHtml(d.book.slice(0, 60)) + '</h3>' +
        '<p class="mc-fail">' + escapeHtml(d.name) + '</p>' +
        (d.bookGain ? '<p class="mc-book">' + escapeHtml(d.bookGain.slice(0, 90)) + '…</p>' : '');
      openFromEl(btn, d);
      row.appendChild(btn);
    });
  }

  // -------- BROWSE --------
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

  function renderBoard(filter) {
    renderChips();
    var q = (filter || '').toLowerCase().trim();
    var board = $('#board');
    board.innerHTML = '';

    var cats = activeCategory === 'all'
      ? categories
      : categories.filter(function (c) { return c.key === activeCategory; });

    cats.forEach(function (cat) {
      var items = (richByCategory[cat.key] || []).filter(function (d) {
        if (!q) return true;
        var blob = [d.name, d.fail, d.story, d.category, d.takeaway, d.book, d.whatTheyDid].join(' ').toLowerCase();
        return blob.indexOf(q) !== -1;
      });
      if (!items.length) return;
      var col = document.createElement('section');
      col.className = 'column';
      col.innerHTML =
        '<div class="column-header">' +
        '<span class="column-dot ' + cat.dot + '"></span>' +
        '<h2>' + escapeHtml(cat.key) + '</h2>' +
        '<span class="count">' + items.length + '</span></div>' +
        '<div class="column-cards"></div>';
      var cardsEl = col.querySelector('.column-cards');
      items.forEach(function (d) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.innerHTML = cardInner(d);
        openFromEl(card, d);
        cardsEl.appendChild(card);
      });
      board.appendChild(col);
    });

    if (!board.children.length) {
      if (q) {
        board.innerHTML = '<div class="empty-state"><div class="empty-icon">∅</div>' +
          '<div class="empty-text">No matches for "' + escapeHtml(q) + '".</div>' +
          '<div class="empty-hint">Try a different search or browse by category.</div></div>';
      } else {
        board.innerHTML = '<div class="empty-state"><div class="empty-icon">∅</div>' +
          '<div class="empty-text">No cases in this category.</div>' +
          '<div class="empty-hint">Try "All" or pick another category.</div></div>';
      }
    }
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
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">★</div>' +
          '<div class="empty-text">Nothing saved yet.</div>' +
          '<div class="empty-hint">Open a playbook and tap Save.</div></div>';
        return;
      }
      items.forEach(function (d) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lib-item';
        btn.innerHTML =
          '<h3>' + escapeHtml(d.name) + '</h3>' +
          '<p class="sub">' + escapeHtml(d.fail) + '</p>' +
          (d.book && d.book !== '—' ? '<p class="book-line">' + escapeHtml(d.book) + '</p>' : '');
        openFromEl(btn, d);
        list.appendChild(btn);
      });
    } else {
      var books = RICH.filter(function (d) { return d.book && d.book !== '—'; });
      if (!books.length) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">🕮</div>' +
          '<div class="empty-text">No book recommendations yet.</div></div>';
        return;
      }
      books.forEach(function (d) {
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
      '<div class="stat"><div class="num">' + RICH.filter(function (d) { return d.real; }).length.toLocaleString() + '</div><div class="lbl">Real cases</div></div>';
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

  function readingTime(text) {
    if (!text) return '';
    var words = text.trim().split(/\s+/).length;
    var mins = Math.max(1, Math.round(words / 200));
    return mins + ' min read';
  }

  function modalBodyForRich(d) {
    var rt = readingTime((d.story || '') + ' ' + (d.whatTheyDid || ''));
    var rtHtml = rt ? '<span class="modal-reading-time">· ' + escapeHtml(rt) + '</span>' : '';
    return '<section><h3>The story' + (d.real ? ' · real documented event' : '') + rtHtml + '</h3><p>' + escapeHtml(d.story) + '</p></section>' +
      '<section><h3>What they did</h3><p>' + escapeHtml(d.whatTheyDid) + '</p></section>' +
      (d.apply && d.apply.length ? '<section><h3>How you can apply it</h3>' + listHtml(d.apply) + '</section>' : '') +
      (d.scenariosYes || d.scenariosNo ?
        '<section class="split">' +
          '<div><h3>Use this when</h3>' + listHtml(d.scenariosYes) + '</div>' +
          '<div><h3>Don\'t force it when</h3>' + listHtml(d.scenariosNo) + '</div>' +
        '</section>' : '') +
      (d.resources && d.resources.length ? '<section><h3>Resources needed</h3>' + listHtml(d.resources) + '</section>' : '') +
      (d.takeaway ? '<section class="takeaway"><h3>Takeaway</h3><p>' + escapeHtml(d.takeaway) + '</p></section>' : '') +
      (d.book && d.book !== '—' ? '<section><h3>Book to read</h3><p class="book">' + escapeHtml(d.book) + '</p></section>' : '') +
      (d.bookGain ? '<section><h3>What you get from the book</h3><p>' + escapeHtml(d.bookGain) + '</p></section>' : '');
  }

  function openModal(d) {
    if (!d) return;
    currentModalId = d.id;
    $('#modal-title').textContent = d.name || '';
    $('#modal-fail').textContent = d.fail || '';
    $('#modal-cat').textContent = (d.category || '') + (d.year ? ' · ' + d.year : '') + (d.real ? ' · real case' : '');

    var av = $('#modal-avatar');
    av.innerHTML = '';
    av.style.background = d.color || '#555';
    av.textContent = d.initials || '';
    if (d.img) {
      var img = document.createElement('img');
      img.alt = d.name || '';
      // Set onload BEFORE src — required for cached images that complete
      // before the handler attaches.
      img.onload = function () {
        av.textContent = '';
        av.appendChild(img);
      };
      img.onerror = function () {
        // silent — initials remain visible as fallback
        img.remove();
      };
      img.src = imgUrl(d.img, 160);
      // If image is already complete (cached), onload may have already fired
      // before we attached the handler. Force the append in that case.
      if (img.complete && img.naturalWidth > 0) {
        av.textContent = '';
        av.appendChild(img);
      }
    }

    updateSaveBtn();
    $('#modal-body').innerHTML = modalBodyForRich(d);

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

  function showNotFound(id) {
    var main = $('#view-home');
    main.classList.remove('active');
    var browse = $('#view-browse');
    browse.classList.add('active');
    browse.innerHTML = '<div class="not-found"><h1>404</h1>' +
      '<p>No playbook found for <code>' + escapeHtml(id) + '</code>.</p>' +
      '<p>The URL may be misspelled, or the entry was removed.</p>' +
      '<p><button type="button" class="btn primary" onclick="location.hash = \'#/\'">Back to home</button></p>' +
      '</div>';
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
        showNotFound(r.id);
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
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // -------- WIRE UP --------
  document.addEventListener('DOMContentLoaded', function () {
    if (!RICH.length) {
      $('#view-home').innerHTML = '<div class="empty-state"><div class="empty-icon">∅</div>' +
        '<div class="empty-text">No data loaded.</div>' +
        '<div class="empty-hint">Check data.js and real-cases.js.</div></div>';
      return;
    }

    // Theme — apply early to avoid flash
    initTheme();

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
      scheduleSearch($('#search').value);
    });

    $('#reshuffle').addEventListener('click', function (e) {
      e.stopPropagation();
      renderDaily(true);
    });

    $('#quick-random').addEventListener('click', function () {
      if (!RICH.length) return;
      openModal(RICH[Math.floor(Math.random() * RICH.length)]);
    });

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', closeModal);

    $('#save-btn').addEventListener('click', function () {
      if (currentModalId) toggleSave(currentModalId);
    });

    var shareBtn = $('#share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (!currentModalId) return;
        var shareUrl = location.origin + location.pathname + '#/entry/' + encodeURIComponent(currentModalId);
        var shareData = { title: 'Famous Failures', text: 'Check out this failure playbook', url: shareUrl };
        if (navigator.share) {
          navigator.share(shareData).then(function () {
            toast('Shared', 'success');
          }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            toast('Link copied to clipboard', 'success');
          }).catch(function () {
            toast('Copy failed', 'error');
          });
        } else {
          window.prompt('Copy this URL:', shareUrl);
        }
      });
    }

    $('#display-name').addEventListener('change', function () {
      lsSet(NAME_KEY, $('#display-name').value);
      renderProfile();
      toast('Name saved');
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
        toast('Library cleared');
      }
    });
    $('#reset-all').addEventListener('click', function () {
      if (confirm('Reset name and library on this device?')) {
        lsDel(STORAGE_KEY); lsDel(NAME_KEY); lsDel(DAILY_KEY); lsDel(VISITED_KEY);
        renderProfile();
        renderLibrary();
        renderHomeSaved();
        renderRecentlyViewed();
        toast('All local data reset');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      var modalOpen = !$('#modal').hidden;
      if (e.key === 'Escape') {
        if (modalOpen) closeModal();
        return;
      }
      // Don't trigger shortcuts when typing in inputs
      if (/^(input|textarea)$/i.test(document.activeElement.tagName)) return;
      if (e.key === '/' && !modalOpen) {
        e.preventDefault();
        $('#search').focus();
        $('#search').select();
      } else if (e.key === 'g' && !modalOpen) {
        // Wait for next keystroke
        var gHandler = function (ev) {
          var map = { h: 'home', b: 'browse', l: 'library', p: 'profile' };
          if (map[ev.key]) {
            e.preventDefault();
            showView(map[ev.key]);
          }
          document.removeEventListener('keydown', gHandler);
        };
        document.addEventListener('keydown', gHandler);
        setTimeout(function () { document.removeEventListener('keydown', gHandler); }, 800);
      } else if (e.key === 'r' && !modalOpen) {
        // Random
        if (RICH.length) openModal(RICH[Math.floor(Math.random() * RICH.length)]);
      } else if (e.key === 't' && !modalOpen) {
        // Theme toggle
        var toggle = $('.theme-toggle');
        if (toggle) toggle.click();
      }
    });

    window.addEventListener('hashchange', applyRoute);
    applyRoute();
    registerSW();
  });
})();
