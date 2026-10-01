document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const search = document.getElementById('search');
  const modal = document.getElementById('modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose = document.getElementById('modal-close');
  const data = window.FAILURES || [];

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
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=88`;
  }

  function renderBoard(filter = '') {
    const q = filter.toLowerCase().trim();
    board.innerHTML = '';

    categories.forEach(cat => {
      const items = data.filter(d => {
        if (d.category !== cat.key) return false;
        if (!q) return true;
        const blob = `${d.name} ${d.fail} ${d.story} ${d.category}`.toLowerCase();
        return blob.includes(q);
      });

      const col = document.createElement('section');
      col.className = 'column';
      col.innerHTML = `
        <div class="column-header">
          <span class="column-dot ${cat.dot}"></span>
          <h2>${cat.key}</h2>
          <span class="count">${items.length}</span>
        </div>
        <div class="column-cards"></div>
      `;
      const cardsEl = col.querySelector('.column-cards');

      items.forEach(d => {
        const card = document.createElement('article');
        card.className = 'card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.innerHTML = `
          <div class="card-top">
            <div class="pic">
              ${d.img ? `<img src="${imgUrl(d.img)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('fallback')">` : ''}
              <span class="avatar" style="--bg:${d.color}">${d.initials}</span>
            </div>
            <div>
              <h3>${d.name}</h3>
              <p class="fail">${d.fail}</p>
            </div>
          </div>
          <p class="body">${(d.story || '').slice(0, 110)}…</p>
          <div class="card-meta">${d.year || ''} · click for playbook</div>
        `;
        card.addEventListener('click', () => openModal(d));
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(d);
          }
        });
        cardsEl.appendChild(card);
      });

      board.appendChild(col);
    });
  }

  function openModal(d) {
    document.getElementById('modal-title').textContent = d.name;
    document.getElementById('modal-fail').textContent = d.fail;
    document.getElementById('modal-cat').textContent = `${d.category} · ${d.year || ''}`;

    const av = document.getElementById('modal-avatar');
    av.innerHTML = '';
    av.style.background = d.color;
    if (d.img) {
      const img = document.createElement('img');
      img.src = imgUrl(d.img).replace('width=88', 'width=160');
      img.alt = d.name;
      img.onerror = () => {
        av.textContent = d.initials;
        img.remove();
      };
      av.appendChild(img);
    } else {
      av.textContent = d.initials;
    }

    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <section>
        <h3>The story</h3>
        <p>${d.story || ''}</p>
      </section>
      <section>
        <h3>What they did</h3>
        <p>${d.whatTheyDid || ''}</p>
      </section>
      <section>
        <h3>How you can apply it</h3>
        <ul>${(d.apply || []).map(a => `<li>${a}</li>`).join('')}</ul>
      </section>
      <section class="split">
        <div>
          <h3>Use this when</h3>
          <ul>${(d.scenariosYes || []).map(a => `<li>${a}</li>`).join('')}</ul>
        </div>
        <div>
          <h3>Don’t force it when</h3>
          <ul>${(d.scenariosNo || []).map(a => `<li>${a}</li>`).join('')}</ul>
        </div>
      </section>
      <section>
        <h3>Resources needed</h3>
        <ul>${(d.resources || []).map(a => `<li>${a}</li>`).join('')}</ul>
      </section>
      <section class="takeaway">
        <h3>Takeaway</h3>
        <p>${d.takeaway || ''}</p>
      </section>
      <section>
        <h3>Book to read</h3>
        <p class="book">${d.book || '—'}</p>
      </section>
    `;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  search.addEventListener('input', () => renderBoard(search.value));
  renderBoard();
});