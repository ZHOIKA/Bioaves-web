(() => {
  'use strict';
  // Mapa Interativo - Código do Leaflet
      const map = L.map('map').setView([-5.2, -45.3], 6);
      const lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        tileSize: 256
      });
      const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors & Carto',
        maxZoom: 19,
        tileSize: 256
      });
      let currentTileLayer = null;
      function setMapTheme(theme) {
        if (currentTileLayer) {
          map.removeLayer(currentTileLayer);
        }
        currentTileLayer = theme === 'dark' ? darkTiles : lightTiles;
        currentTileLayer.addTo(map);
        if (window.refreshGeoJsonStyle) {
          window.refreshGeoJsonStyle();
        }
      }
      window.setMapTheme = setMapTheme;
      setMapTheme(document.documentElement.getAttribute('data-theme') || 'light');
      // expose map to other scripts
      window.map = map;

      let selectedLayer = null;
      let hoveredLayer = null;
      let municipalities = [];
      const searchInput = document.getElementById('search-input');
      const searchResults = document.getElementById('search-results');

      function escapeHtml(value) {
        return String(value).replace(/[&<>\"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
      }

      function normalizeText(text) {
        return String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      }

      function renderSearchResults(items) {
        searchResults.innerHTML = '';
        if (!items.length) {
          searchResults.style.display = 'none';
          return;
        }
        searchResults.style.display = 'block';
        items.forEach(({ name, id, layer }) => {
          const div = document.createElement('div');
          div.className = 'search-item';
          div.setAttribute('role', 'option');
          const strong = document.createElement('strong');
          strong.textContent = String(name || '');
          const span = document.createElement('span');
          span.textContent = `ID: ${id ?? ''}`;
          div.append(strong, span);
          div.addEventListener('click', () => {
            searchInput.value = name;
            searchResults.style.display = 'none';
            selectLayer(layer);
          });
          searchResults.appendChild(div);
        });
      }

      function filterMunicipalities(query) {
        const normalized = normalizeText(query);
        if (!normalized) {
          searchResults.style.display = 'none';
          return [];
        }
        return municipalities
          .filter(item => normalizeText(item.name).includes(normalized) || String(item.id).includes(normalized))
          .slice(0, 12);
      }

      function updateSearch(event) {
        const query = event.target.value;
        const matches = filterMunicipalities(query);
        renderSearchResults(matches);
      }

      function selectLayer(layer) {
        if (!layer) return;
        const props = layer.feature.properties || {};
        clearSelection();
        selectedLayer = layer;
        layer.setStyle(selectedStyle);
        if (layer.getPopup && layer.getPopup()) {
          layer.openPopup();
        }
        showSidebar(props);
        // If page script exposes a filter function, use it to filter birds by the clicked region
        try {
          const regionName = props.name || props.nome || '';
          if (window.filterByRegion && regionName) {
            window.filterByRegion(regionName);
          }
          // Also expose region selection to admin form (if admin logged in)
          if (window.assignRegionToForm && regionName) {
            window.assignRegionToForm(regionName);
          }
        } catch (err) {
          console.warn('Error calling global region handlers', err);
        }
        map.fitBounds(layer.getBounds(), { maxZoom: 10, padding: [20, 20] });
      }

      searchInput.addEventListener('input', updateSearch);
      searchInput.addEventListener('focus', updateSearch);
      searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          searchResults.style.display = 'none';
        }
      });

      map.on('click', function () {
        hideSidebar();
        searchResults.style.display = 'none';
        clearSelection();
      });

      // Info control removed per user request (no "Município selecionado" box)

      function styleFeature(feature) {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dark') {
          return {
            color: '#38bdf8',
            weight: 1,
            fillColor: '#0d4f69',
            fillOpacity: 0.32
          };
        }
        return {
          color: '#007700',
          weight: 1,
          fillOpacity: 0.4
        };
      }

      const highlightStyle = {
        weight: 3,
        color: '#facc15',
        fillColor: '#f59e0b',
        fillOpacity: 0.65
      };

      const selectedStyle = {
        weight: 3,
        color: '#38bdf8',
        fillColor: '#0e4c6d',
        fillOpacity: 0.55
      };

      function highlightFeature(e) {
        const layer = e.target;
        if (selectedLayer === layer) return;
        hoveredLayer = layer;
        layer.setStyle(highlightStyle);
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          layer.bringToFront();
        }
      }

      function resetHighlight(e) {
        const layer = e.target;
        if (selectedLayer !== layer) {
          geojson.resetStyle(layer);
        } else {
          layer.setStyle(selectedStyle);
        }
        if (hoveredLayer === layer) hoveredLayer = null;
      }

      function selectFeature(e) {
        const layer = e.target;
        selectLayer(layer);
      }

      function resetAllLayers() {
        if (!geojson || typeof geojson.eachLayer !== 'function') return;
        geojson.eachLayer(layer => {
          if (layer && layer.feature) {
            geojson.resetStyle(layer);
          }
        });
      }

      function clearSelection() {
        resetAllLayers();
        selectedLayer = null;
        hoveredLayer = null;
      }

      function showSidebar(props) {
        const sb = document.getElementById('sidebar');
        const body = document.getElementById('sidebar-body');
        body.textContent = '';
        const rows = [
          ['Nome', props.name || props.nome || '—'],
          ['ID', props.id || '—'],
          ['Descrição', props.description || '']
        ];
        rows.forEach(([label, value]) => {
          const p = document.createElement('p');
          const strong = document.createElement('strong');
          strong.textContent = `${label}: `;
          p.append(strong, document.createTextNode(String(value)));
          body.appendChild(p);
        });
        const extra = document.createElement('p');
        const extraStrong = document.createElement('strong');
        extraStrong.textContent = 'Outros dados:';
        extra.appendChild(extraStrong);
        body.appendChild(extra);
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.textContent = JSON.stringify(props, null, 2);
        body.appendChild(pre);
        sb.style.display = 'block';
        sb.setAttribute('aria-hidden', 'false');
      }

      function hideSidebar() {
        const sb = document.getElementById('sidebar');
        sb.style.display = 'none';
        sb.setAttribute('aria-hidden', 'true');
      }

      document.getElementById('sidebar-close').addEventListener('click', hideSidebar);

      function onEachFeature(feature, layer) {
        const props = feature.properties || {};
        const popupContent = `<strong>${escapeHtml(String(props.name || props.nome || ''))}</strong><br>${escapeHtml(String(props.description || ''))}`;
        layer.bindPopup(popupContent);

        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          selectFeature(e);
        });
        layer.on('mouseover', function (e) {
          L.DomEvent.stopPropagation(e);
          highlightFeature(e);
        });
        layer.on('mouseout', function (e) {
          L.DomEvent.stopPropagation(e);
          resetHighlight(e);
        });
      }

      map.on('mousemove', function (e) {
        if (!hoveredLayer || !hoveredLayer._path) return;
        const target = e.originalEvent && e.originalEvent.target;
        if (target !== hoveredLayer._path) {
          if (selectedLayer !== hoveredLayer) {
            geojson.resetStyle(hoveredLayer);
          } else {
            hoveredLayer.setStyle(selectedStyle);
          }
          hoveredLayer = null;
        }
      });

      const geojson = L.geoJSON(null, {
        style: styleFeature,
        onEachFeature: onEachFeature
      }).addTo(map);

      window.refreshGeoJsonStyle = function () {
        if (geojson && typeof geojson.setStyle === 'function') {
          geojson.setStyle(styleFeature);
        }
      };

      fetch('geojson/geojs-21-mun.json')
        .then(res => res.json())
        .then(data => {
          geojson.addData(data);
          municipalities = [];
          geojson.eachLayer(layer => {
            const props = layer.feature.properties || {};
            const center = layer.getBounds ? layer.getBounds().getCenter() : (layer.getLatLng ? layer.getLatLng() : null);
            municipalities.push({
              id: props.id || props.codigo || '',
              name: props.name || props.nome || 'Sem nome',
              layer,
              center: center ? [center.lat, center.lng] : null
            });
          });
          // If page script exposes a registrator, provide the municipality names for the admin select
          try {
            if (window.registerMunicipalities) {
              window.registerMunicipalities(municipalities.map(m => ({ name: m.name, center: m.center })));
            }
          } catch (e) {
            console.warn('Erro ao registrar municípios no script principal', e);
          }

          const bounds = geojson.getBounds();
          if (bounds && typeof bounds.isValid === 'function' ? bounds.isValid() : true) {
            map.fitBounds(bounds);
            map.setMaxBounds(bounds.pad(0.15));
            const fitZoom = map.getZoom();
            map.setMinZoom(fitZoom);
            map.setMaxZoom(fitZoom + 6);
          }
        })
        .catch(err => console.warn('GeoJSON não encontrado em geojson/geojs-21-mun.json', err));
})();
