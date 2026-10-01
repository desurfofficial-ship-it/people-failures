document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('search');
  const columns = document.querySelectorAll('.column');

  function updateCounts() {
    columns.forEach(col => {
      const cards = col.querySelectorAll('.card:not(.hidden)');
      const countEl = col.querySelector('[data-count]');
      if (countEl) countEl.textContent = cards.length;
    });
  }

  function filter() {
    const q = (search.value || '').toLowerCase().trim();
    document.querySelectorAll('.card').forEach(card => {
      const text = card.textContent.toLowerCase();
      const name = (card.dataset.name || '').toLowerCase();
      const show = !q || name.includes(q) || text.includes(q);
      card.classList.toggle('hidden', !show);
    });
    updateCounts();
  }

  search.addEventListener('input', filter);
  updateCounts();
});