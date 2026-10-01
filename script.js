(function () {
  var data = Array.isArray(window.FAILURES) ? window.FAILURES : [];
  var STORAGE_KEY = 'gf_library';
  var NAME_KEY = 'gf_name';
  var DAILY_KEY = 'gf_daily';

  var categories = [
    { key: 'Technology', dot: 'tech', color: '#38bdf8' },
    { key: 'Business', dot: 'business', color: '#a78bfa' },
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

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function imgUrl(filename, w) {
    if (!filename) return '';
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(filename) + '?width=' + (w || 88);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function setSaved(ids) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch (e) {}
  }

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

  function byId(id) {
    for (var i = 0; i < data.length; i++) if (data[i].id === id) return data[i];
    return null;
  }

  function dailyPick(force) {
    var today = new Date().toISOString().slice(0, 10);
    try {
      var stored = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
      if (!force && stored.date === today && byId(stored.id)) return byId(stored.id);
    } catch (e) {}
    var d = data[Math.floor(Math.random() * data.length)];
    try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today, id: d.id })); } catch (e) {}
    return d;
  }

  function picHtml(d, sizeClass) {
    return '<div class="' + sizeClass + '" style="background:' + escapeHtml(d.color || '#555') + '">' +
      '<span class="avatar">' + escapeHtml(d.initials || '?') + '</span>' +
      (d.img
        ? '<img src="' + imgUrl(d.img) + '" alt="" loading="lazy" onload="this.classList.add(\x27loaded\x27)" onerror="this.style.display=\x27none\x27">'
        : '') +
      '</div>';
  }

  function showView(name) {
    currentView = name;
    $$('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + name);
    });
    $$('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === name);
    });
    if (name === 'browse') renderBoard($('#search').value);
    if (name === 'home') renderHome();
    if (name === 'library') renderLibrary();
    if (name === 'profile') renderProfile();
    window.scrollTo(0, 0);
  }

  function openFromEl(el, d) {
    el.addEventListener('click', function () { openModal(d); });
  }

  // ── HOME ──
  function renderHome() {
    var name = '';
    try { name = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    $('#greet-line').textContent = name ? greet + ', ' + name.split(' ')[0] : greet;
    $('#stat-total').textContent = String(data.length);

    renderDaily(false);
    renderCats();
    renderHomeSaved();
    renderWorth();
    renderBooksStrip();
  }

  function renderDaily(force) {
    var d = dailyPick(force);
    var el = $('#daily-card');
    el.innerHTML =
      '<div class="dc-top">' + picHtml(d, 'dc-pic') +
        '<div><p class="dc-cat">' + escapeHtml(d.category) + '</p>' +
        '<h2>' + escapeHtml(d.name) + '</h2>' +
        '<p class="dc-fail">' + escapeHtml(d.fail) + '</p></div></div>' +
      '<p class="dc-body">' + escapeHtml((d.story || '').slice(0, 160)) + ((d.story || '').length > 160 ? '\u2026' : '') + '</p>' +
      '<p class="dc-cta">Open full playbook \u2192</p>';
    el.onclick = function () { openModal(d); };
  }

  function renderCats() {
    var row = $('#cat-scroll');
    row.innerHTML = '';
    categories.forEach(function (cat) {
      var n = 0;
      for (var i = 0; i < data.length; i++) if (data[i].category === cat.key) n++;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-pill';
      btn.innerHTML =
        '<span class="cp-dot" style="background:' + cat.color + '"></span>' +
        '<span class="cp-name">' + escapeHtml(cat.key) + '</span>' +
        '<span class="cp-n">' + n + ' cards</span>';
      btn.addEventListener('click', function () {
        activeCategory = cat.key;
        showView('browse');
      });
      row.appendChild(btn);
    });
  }

  function renderHomeSaved() {
    var section = $('#saved-section');
    var row = $('#saved-row');
    var ids = getSaved().slice(0, 8);
    var items = ids.map(byId).filter(Boolean);
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
    // deterministic-ish mix: first of each category-ish
    var picks = [];
    var used = {};
    var order = [0, 3, 7, 12, 18, 22, 28, 35];
    for (var i = 0; i < order.length; i++) {
      var idx = order[i] % data.length;
      if (!used[data[idx].id]) {
        picks.push(data[idx]);
        used[data[idx].id] = true;
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
        '<span class="lr-go">\u203a</span>';
      openFromEl(btn, d);
      list.appendChild(btn);
    });
  }

  function renderBooksStrip() {
    var row = $('#books-row');
    row.innerHTML = '';
    var books = data.filter(function (d) { return d.book; }).slice(0, 10);
    books.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-card';
      btn.innerHTML =
        '<h3 style="font-size:0.8rem;margin-bottom:0.35rem">' + escapeHtml(d.book) + '</h3>' +
        '<p class="mc-fail">' + escapeHtml(d.name) + '</p>' +
        (d.bookGain ? '<p class="mc-book">' + escapeHtml(d.bookGain.slice(0, 90)) + '\u2026</p>' : '');
      openFromEl(btn, d);
      row.appendChild(btn);
    });
  }

  // ── BROWSE ──
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
      });
      row.appendChild(b);
    }
    addChip('All', 'all');
    categories.forEach(function (c) { addChip(c.key, c.key); });
  }

  function cardHtml(d) {
    var excerpt = (d.story || '').slice(0, 100);
    if ((d.story || '').length > 100) excerpt += '\u2026';
    return '<div class="card-top">' + picHtml(d, 'pic') +
      '<div><h3>' + escapeHtml(d.name) + '</h3>' +
      '<p class="fail">' + escapeHtml(d.fail) + '</p></div></div>' +
      '<p class="body">' + escapeHtml(excerpt) + '</p>' +
      '<div class="card-meta">' + escapeHtml(d.year || '') +
      (isSaved(d.id) ? ' \u00b7 saved' : '') + '</div>';
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
      var items = data.filter(function (d) {
        if (d.category !== cat.key) return false;
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
        '<span class="count">' + items.length + '</span></div>' +
        '<div class="column-cards"></div>';
      var cardsEl = col.querySelector('.column-cards');
      items.forEach(function (d) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.innerHTML = cardHtml(d);
        openFromEl(card, d);
        cardsEl.appendChild(card);
      });
      board.appendChild(col);
    });

    if (!board.children.length) {
      board.innerHTML = '<p class="empty-msg">No matches. Clear search or pick another category.</p>';
    }
  }

  // ── LIBRARY ──
  function renderLibrary() {
    $$('.lib-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-lib') === libTab);
    });
    var list = $('#library-list');
    list.innerHTML = '';

    if (libTab === 'saved') {
      var items = getSaved().map(byId).filter(Boolean);
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
      data.filter(function (d) { return d.book; }).forEach(function (d) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lib-item';
        btn.innerHTML =
          '<h3>' + escapeHtml(d.book) + '</h3>' +
          '<p class="sub">' + escapeHtml(d.name) + ' \u00b7 ' + escapeHtml(d.category) + '</p>' +
          (d.bookGain ? '<p class="sub" style="margin-top:0.35rem">' + escapeHtml(d.bookGain) + '</p>' : '');
        openFromEl(btn, d);
        list.appendChild(btn);
      });
    }
  }

  function renderProfile() {
    var name = '';
    try { name = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
    $('#display-name').value = name;
    $('#profile-avatar').textContent = (name.trim() || 'G').charAt(0).toUpperCase();
    var saved = getSaved().length;
    $('#profile-stats').innerHTML =
      '<div class="stat"><div class="num">' + data.length + '</div><div class="lbl">Stories</div></div>' +
      '<div class="stat"><div class="num">' + saved + '</div><div class="lbl">Saved</div></div>' +
      '<div class="stat"><div class="num">' + categories.length + '</div><div class="lbl">Topics</div></div>';
  }

  function listHtml(arr) {
    if (!arr || !arr.length) return '<p>\u2014</p>';
    return '<ul>' + arr.map(function (a) {
      return '<li>' + escapeHtml(a) + '</li>';
    }).join('') + '</ul>';
  }

  function updateSaveBtn() {
    var btn = $('#save-btn');
    if (!btn || !currentModalId) return;
    var on = isSaved(currentModalId);
    btn.textContent = on ? 'Saved \u2713' : 'Save to library';
  }

  function openModal(d) {
    if (!d) return;
    currentModalId = d.id;
    $('#modal-title').textContent = d.name || '';
    $('#modal-fail').textContent = d.fail || '';
    $('#modal-cat').textContent = (d.category || '') + (d.year ? ' \u00b7 ' + d.year : '');

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

    $('#modal-body').innerHTML =
      '<section><h3>The story</h3><p>' + escapeHtml(d.story) + '</p></section>' +
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

    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
    currentModalId = null;
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!data.length) {
      $('#view-home').innerHTML = '<p class="empty-msg">No data loaded. Check data.js.</p>';
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
      if (q.trim()) {
        if (currentView !== 'browse') {
          activeCategory = 'all';
          showView('browse');
        } else {
          renderBoard(q);
        }
      } else if (currentView === 'browse') {
        renderBoard('');
      }
    });

    $('#reshuffle').addEventListener('click', function (e) {
      e.stopPropagation();
      renderDaily(true);
    });

    $('#quick-random').addEventListener('click', function () {
      var d = data[Math.floor(Math.random() * data.length)];
      openModal(d);
    });

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    $('#save-btn').addEventListener('click', function () {
      if (currentModalId) toggleSave(currentModalId);
    });

    $('#display-name').addEventListener('change', function () {
      try { localStorage.setItem(NAME_KEY, $('#display-name').value); } catch (e) {}
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
      }
    });
    $('#reset-all').addEventListener('click', function () {
      if (confirm('Reset name and library on this device?')) {
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(NAME_KEY);
          localStorage.removeItem(DAILY_KEY);
        } catch (e) {}
        renderProfile();
        renderLibrary();
      }
    });

    showView('home');
  });
})();
