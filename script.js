(function () {
  const data = Array.isArray(window.FAILURES) ? window.FAILURES : [];
  const STORAGE_KEY = 'gf_library';
  const NAME_KEY = 'gf_name';

  const categories = [
    { key: 'Technology', dot: 'tech', color: '#38bdf8' },
    { key: 'Business', dot: 'business', color: '#a78bfa' },
    { key: 'Literature', dot: 'literature', color: '#f472b6' },
    { key: 'Science', dot: 'science', color: '#34d399' },
    { key: 'Sports', dot: 'sports', color: '#fb923c' },
    { key: 'Entertainment', dot: 'entertainment', color: '#facc15' },
    { key: 'Politics & Fashion', dot: 'other', color: '#94a3b8' }
  ];

  let currentView = 'home';
  let activeCategory = 'all';
  let libTab = 'saved';
  let currentModalId = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

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
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function setSaved(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  function isSaved(id) {
    return getSaved().indexOf(id) !== -1;
  }

  function toggleSave(id) {
    const list = getSaved();
    const i = list.indexOf(id);
    if (i === -1) list.push(id);
    else list.splice(i, 1);
    setSaved(list);
    updateSaveBtn();
    if (currentView === 'library') renderLibrary();
    if (currentView === 'profile') renderProfile();
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

  function cardHtml(d, compact) {
    var excerpt = (d.story || '').slice(0, compact ? 90 : 110);
    if ((d.story || '').length > (compact ? 90 : 110)) excerpt += '\u2026';
    var pic =
      '<div class="pic" style="--bg:' + escapeHtml(d.color || '#555') + ';background:' + escapeHtml(d.color || '#555') + '">' +
        '<span class="avatar">' + escapeHtml(d.initials || '?') + '</span>' +
        (d.img
          ? '<img src="' + imgUrl(d.img) + '" alt="" loading="lazy" onload="this.classList.add(\x27loaded\x27)" onerror="this.style.display=\x27none\x27">'
          : '') +
      '</div>';
    return (
      '<div class="card-top">' + pic +
        '<div><h3>' + escapeHtml(d.name) + '</h3>' +
        '<p class="fail">' + escapeHtml(d.fail) + '</p></div></div>' +
      '<p class="body">' + escapeHtml(excerpt) + '</p>' +
      '<div class="card-meta">' + escapeHtml(d.year || '') +
        (isSaved(d.id) ? ' \u00b7 saved' : '') + '</div>'
    );
  }

  function bindCardClick(el, d) {
    el.addEventListener('click', function () { openModal(d); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(d);
      }
    });
  }

  function renderHome() {
    var featured = data.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 6);
    var row = $('#featured-row');
    row.innerHTML = '';
    featured.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.innerHTML = cardHtml(d, true);
      bindCardClick(btn, d);
      row.appendChild(btn);
    });

    var grid = $('#cat-grid');
    grid.innerHTML = '';
    categories.forEach(function (cat) {
      var n = data.filter(function (d) { return d.category === cat.key; }).length;
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'cat-tile';
      tile.innerHTML =
        '<span class="dot" style="background:' + cat.color + '"></span>' +
        '<span class="name">' + escapeHtml(cat.key) + '</span>' +
        '<span class="n">' + n + ' cards</span>';
      tile.addEventListener('click', function () {
        activeCategory = cat.key;
        showView('browse');
      });
      grid.appendChild(tile);
    });

    renderRandom();
  }

  function renderRandom() {
    if (!data.length) return;
    var d = data[Math.floor(Math.random() * data.length)];
    var slot = $('#random-card');
    slot.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card';
    btn.style.maxWidth = '420px';
    btn.innerHTML = cardHtml(d, false);
    bindCardClick(btn, d);
    slot.appendChild(btn);
  }

  function renderChips() {
    var row = $('#chip-row');
    row.innerHTML = '';
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'chip' + (activeCategory === 'all' ? ' active' : '');
    all.textContent = 'All';
    all.addEventListener('click', function () {
      activeCategory = 'all';
      renderBoard($('#search').value);
      renderChips();
    });
    row.appendChild(all);
    categories.forEach(function (cat) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (activeCategory === cat.key ? ' active' : '');
      b.textContent = cat.key;
      b.addEventListener('click', function () {
        activeCategory = cat.key;
        renderBoard($('#search').value);
        renderChips();
      });
      row.appendChild(b);
    });
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
        card.innerHTML = cardHtml(d, false);
        bindCardClick(card, d);
        cardsEl.appendChild(card);
      });
      board.appendChild(col);
    });

    if (!board.children.length) {
      board.innerHTML = '<p class="empty-msg">No matches. Try another search or category.</p>';
    }
  }

  function renderLibrary() {
    $$('.lib-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-lib') === libTab);
    });
    var list = $('#library-list');
    list.innerHTML = '';

    if (libTab === 'saved') {
      var ids = getSaved();
      var items = ids.map(function (id) {
        return data.find(function (d) { return d.id === id; });
      }).filter(Boolean);
      if (!items.length) {
        list.innerHTML = '<p class="empty-msg">No saved cards yet. Open a playbook and tap “Save to library”.</p>';
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
        bindCardClick(btn, d);
        list.appendChild(btn);
      });
    } else {
      var books = data.filter(function (d) { return d.book; });
      books.forEach(function (d) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lib-item';
        btn.innerHTML =
          '<h3>' + escapeHtml(d.book) + '</h3>' +
          '<p class="sub">For ' + escapeHtml(d.name) + ' · ' + escapeHtml(d.category) + '</p>' +
          (d.bookGain ? '<p class="sub" style="margin-top:0.35rem">' + escapeHtml(d.bookGain) + '</p>' : '');
        bindCardClick(btn, d);
        list.appendChild(btn);
      });
    }
  }

  function renderProfile() {
    var name = localStorage.getItem(NAME_KEY) || '';
    var input = $('#display-name');
    input.value = name;
    $('#profile-avatar').textContent = (name.trim() || 'G').charAt(0).toUpperCase();

    var saved = getSaved().length;
    $('#profile-stats').innerHTML =
      '<div class="stat"><div class="num">' + data.length + '</div><div class="lbl">Total cards</div></div>' +
      '<div class="stat"><div class="num">' + saved + '</div><div class="lbl">Saved</div></div>' +
      '<div class="stat"><div class="num">' + categories.length + '</div><div class="lbl">Categories</div></div>';
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
    btn.classList.toggle('primary', !on);
  }

  function openModal(d) {
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
      img.onload = function () {
        av.textContent = '';
        av.appendChild(img);
      };
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

  // Events
  document.addEventListener('DOMContentLoaded', function () {
    if (!data.length) {
      $('#view-home').innerHTML = '<p class="empty-msg">No data loaded.</p>';
      return;
    }

    $$('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        showView(el.getAttribute('data-nav'));
      });
    });

    $$('.lib-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        libTab = t.getAttribute('data-lib');
        renderLibrary();
      });
    });

    $('#search').addEventListener('input', function () {
      var q = $('#search').value;
      if (q.trim() && currentView !== 'browse') {
        activeCategory = 'all';
        showView('browse');
      } else if (currentView === 'browse') {
        renderBoard(q);
      }
    });

    $('#shuffle-btn').addEventListener('click', renderRandom);
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    $('#save-btn').addEventListener('click', function () {
      if (currentModalId) toggleSave(currentModalId);
    });

    $('#display-name').addEventListener('change', function () {
      localStorage.setItem(NAME_KEY, $('#display-name').value);
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
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(NAME_KEY);
        renderProfile();
        renderLibrary();
      }
    });

    showView('home');
  });
})();
