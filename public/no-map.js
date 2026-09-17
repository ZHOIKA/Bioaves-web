(() => {
  'use strict';

  const select = document.getElementById('birdRegion');
  const search = document.getElementById('catalogSearch');
  const grid = document.getElementById('birdGrid');

  async function populateLocations() {
    if (!select) return;
    const fallback = ['Norte', 'Sul', 'Leste', 'Oeste', 'Centro'];
    let names = [...fallback];
    try {
      const response = await fetch('/api/birds', { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const birds = await response.json();
        if (Array.isArray(birds)) {
          names.push(...birds.map(b => String(b.region || '').trim()).filter(Boolean));
        }
      }
    } catch (_) {}

    const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    select.innerHTML = '<option value="">Selecione...</option>';
    unique.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    const other = document.createElement('option');
    other.value = '__other__';
    other.textContent = 'Outra localidade...';
    select.appendChild(other);
  }

  if (select) {
    select.addEventListener('change', () => {
      if (select.value !== '__other__') return;
      const name = window.prompt('Digite a localidade ou região:');
      if (!name || !name.trim()) {
        select.value = '';
        return;
      }
      const clean = name.trim().slice(0, 120);
      const option = document.createElement('option');
      option.value = clean;
      option.textContent = clean;
      select.insertBefore(option, select.lastElementChild);
      select.value = clean;
    });
  }

  function filterCards() {
    if (!search || !grid) return;
    const query = search.value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    let visible = 0;
    grid.querySelectorAll('.card').forEach(card => {
      const text = card.textContent.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      const show = !query || text.includes(query);
      card.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    let empty = document.getElementById('catalogSearchEmpty');
    if (query && visible === 0) {
      if (!empty) {
        empty = document.createElement('p');
        empty.id = 'catalogSearchEmpty';
        empty.className = 'empty-state';
        empty.textContent = 'Nenhuma ave encontrada para essa busca.';
        grid.after(empty);
      }
    } else if (empty) {
      empty.remove();
    }
  }

  if (search) search.addEventListener('input', filterCards);
  if (grid && 'MutationObserver' in window) {
    new MutationObserver(filterCards).observe(grid, { childList: true, subtree: false });
  }

  populateLocations();
})();
