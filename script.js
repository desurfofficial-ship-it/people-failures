document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  const filters = document.querySelectorAll('.filter');
  const cards = document.querySelectorAll('.card');
  const entryCount = document.getElementById('entry-count');

  let activeFilter = 'all';

  function updateVisible() {
    const query = (searchInput.value || '').toLowerCase().trim();
    let visible = 0;

    cards.forEach(card => {
      const name = (card.dataset.name || '').toLowerCase();
      const category = card.dataset.category || '';
      const text = card.textContent.toLowerCase();

      const matchesFilter = activeFilter === 'all' || category === activeFilter;
      const matchesSearch = !query || name.includes(query) || text.includes(query);

      if (matchesFilter && matchesSearch) {
        card.classList.remove('hidden');
        visible++;
      } else {
        card.classList.add('hidden');
      }
    });

    if (entryCount) entryCount.textContent = visible;
  }

  searchInput.addEventListener('input', updateVisible);

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      updateVisible();
    });
  });

  // Initial count
  updateVisible();
});