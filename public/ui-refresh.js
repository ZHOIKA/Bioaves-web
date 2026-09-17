(() => {
  'use strict';

  function enhanceMap() {
    const wrapper = document.getElementById('map-wrapper');
    if (!wrapper || document.querySelector('.map-tools')) return;

    const tools = document.createElement('div');
    tools.className = 'map-tools';

    const reset = document.createElement('button');
    reset.className = 'map-tool-btn';
    reset.type = 'button';
    reset.title = 'Mostrar Maranhão inteiro';
    reset.setAttribute('aria-label', 'Mostrar Maranhão inteiro');
    reset.textContent = '↺';

    reset.addEventListener('click', () => {
      const map = window.map;
      if (!map) return;
      try {
        const bounds = [];
        map.eachLayer(layer => {
          if (layer && typeof layer.getBounds === 'function' && layer.feature) {
            const b = layer.getBounds();
            if (b && b.isValid && b.isValid()) bounds.push(b);
          }
        });
        if (bounds.length) {
          let merged = bounds[0];
          for (let i = 1; i < bounds.length; i += 1) merged.extend(bounds[i]);
          map.fitBounds(merged, { padding: [18, 18] });
        } else {
          map.setView([-5.2, -45.3], 6);
        }
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
          sidebar.style.display = 'none';
          sidebar.setAttribute('aria-hidden', 'true');
        }
        const search = document.getElementById('search-input');
        if (search) search.value = '';
        if (window.filterByRegion) window.filterByRegion('Todos');
      } catch (err) {
        console.warn('Map reset failed', err);
      }
    });

    tools.appendChild(reset);
    wrapper.appendChild(tools);
  }

  function improveThemeButton() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const refresh = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      button.title = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
      button.setAttribute('aria-label', button.title);
    };
    refresh();
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function enhanceCards() {
    const grid = document.getElementById('birdGrid');
    if (!grid) return;
    const apply = () => {
      grid.querySelectorAll('.card').forEach(card => {
        if (card.dataset.bioavesEnhanced) return;
        card.dataset.bioavesEnhanced = '1';
        card.setAttribute('tabindex', '0');
      });
    };
    apply();
    new MutationObserver(apply).observe(grid, { childList: true });
  }

  function init() {
    enhanceMap();
    improveThemeButton();
    enhanceCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
