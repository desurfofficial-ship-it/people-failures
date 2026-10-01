document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const search = document.getElementById('search');
  const modal = document.getElementById('modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose = document.getElementById('modal-close');
  const meta = document.querySelector('.header-right .meta');
  const data = Array.isArray(window.FAILURES) ? window.FAILURES : [];

  if (meta) meta.textContent = data.length + ' cards · click for playbook';

  if (!data.length) {
    board.innerHTML = '<p class="empty-msg">No data loaded. Check that data.js is available.</p>';
    return;
  }

  const categories = [
    { key: 'Technology', dot: 'tech' },
    { key: 'Business', dot: 'business' },
    { key: 'Literature', dot: 'literature' },
    { key: 'Science', dot: 'science' },
    { key: 'Sports', dot: 'sports' },
    { key: 'Entertainment', dot: 'entertainment' },
    { key: 'Politics & Fashion', dot: 'other' }
  ];

  function imgUrl(filename) {
    if (!filename) return '';
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(filename) + '?width=88';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderBoard(filter) {
    const q = (filter || '').toLowerCase().trim();
    board.innerHTML = '';

    categories.forEach(function (cat) {
      const items = data.filter(function (d) {
        if (d.category !== cat.key) return false;
        if (!q) return true;
        var blob = [d.name, d.fail, d.story, d.category, d.takeaway, d.book].join(' ').toLowerCase();
        return blob.indexOf(q) !== -1;
      });

      if (!items.length && q) return;

      var col = document.createElement('section');
      col.className = 'column';
      col.innerHTML =
        '<div class="column-header">' +
          '<span class="column-dot ' + cat.dot + '"></span>' +
          '<h2>' + escapeHtml(cat.key) + '</h2>' +
          '<span class="count">' + items.length + '</span>' +
        '</div>' +
        '<div class="column-cards"></div>';

      var cardsEl = col.querySelector('.column-cards');

      items.forEach(function (d) {
        var card = document.createElement('article');
        card.className = 'card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', d.name + ' — open playbook');

        var picHtml =
          '<div class="pic" style="--bg:' + escapeHtml(d.color || '#555') + '">' +
            '<span class="avatar">' + escapeHtml(d.initials || '?') + '</span>' +
            (d.img
              ? '<img src="' + imgUrl(d.img) + '" alt="" loading="lazy" ' +
                'onload="this.classList.add(\x27loaded\x27)" ' +
                'onerror="this.style.display=\x27none\x27">'
              : '') +
          '</div>';

        var excerpt = (d.story || '').slice(0, 110);
        if ((d.story || '').length > 110) excerpt += '\u2026';

        card.innerHTML =
          '<div class="card-top">' + picHtml +
            '<div>' +
              '<h3>' + escapeHtml(d.name) + '</h3>' +
              '<p class="fail">' + escapeHtml(d.fail) + '</p>' +
            '</div>' +
          '</div>' +
          '<p class="body">' + escapeHtml(excerpt) + '</p>' +
          '<div class="card-meta">' + escapeHtml(d.year || '') + ' · click for playbook</div>';

        card.addEventListener('click', function () { openModal(d); });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(d);
          }
        });
        cardsEl.appendChild(card);
      });

      board.appendChild(col);
    });

    if (!board.children.length) {
      board.innerHTML = '<p class="empty-msg">No matches.</p>';
    }
  }

  function listHtml(arr) {
    if (!arr || !arr.length) return '<p>\u2014</p>';
    return '<ul>' + arr.map(function (a) {
      return '<li>' + escapeHtml(a) + '</li>';
    }).join('') + '</ul>';
  }

  function openModal(d) {
    document.getElementById('modal-title').textContent = d.name || '';
    document.getElementById('modal-fail').textContent = d.fail || '';
    document.getElementById('modal-cat').textContent =
      (d.category || '') + (d.year ? ' \u00b7 ' + d.year : '');

    var av = document.getElementById('modal-avatar');
    av.innerHTML = '';
    av.style.background = d.color || '#555';
    av.textContent = d.initials || '';

    if (d.img) {
      var img = document.createElement('img');
      img.alt = d.name || '';
      img.src = imgUrl(d.img).replace('width=88', 'width=160');
      img.onload = function () {
        av.textContent = '';
        av.appendChild(img);
      };
    }

    document.getElementById('modal-body').innerHTML =
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

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  search.addEventListener('input', function () {
    renderBoard(search.value);
  });

  renderBoard();
});
