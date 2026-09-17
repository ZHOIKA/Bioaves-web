console.log('public/script.js loaded');
(function () {
  'use strict';
  const birdGrid = document.getElementById('birdGrid');
const birdCount = document.getElementById('birdCount');
const adminPanel = document.getElementById('adminPanel');
const adminButton = document.getElementById('adminButton');
const themeToggle = document.getElementById('themeToggle');
const addBirdButton = document.getElementById('addBirdButton');
const btnView = document.getElementById('btn-view');
const feedToggle = document.getElementById('toggleFeedButton');
const scrollDown = document.getElementById('scrollDown');
const formMessage = document.getElementById('formMessage');
const adminStatus = document.getElementById('adminStatus');
const themeRoot = document.documentElement;
const rawPath = window.location.pathname.toLowerCase();
const isAdminRoute = rawPath.includes('admin0803') || window.location.search.toLowerCase().includes('admin0803') || window.location.hash.toLowerCase().includes('admin0803');
if (!isAdminRoute && adminButton) {
  adminButton.style.display = 'none';
}
const revealObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        } else {
          entry.target.classList.remove('visible');
        }
      });
    }, {
      threshold: 0.15
    })
  : null;
const fields = {
  name: document.getElementById('birdName'),
  species: document.getElementById('birdSpecies'),
  locationFound: document.getElementById('birdLocation'),
  photo: document.getElementById('birdPhoto'),
  description: document.getElementById('birdDescription'),
  region: document.getElementById('birdRegion') // select element
};

// Municipalities list will be provided by the map script. Start with only 'Todos'.
let MUNICIPALITIES = [];

function populateRegionOptions(list) {
  try {
    const sel = fields.region;
    if (!sel) return;
    sel.innerHTML = '';
    // Always include 'Todos'
    const allOpt = document.createElement('option');
    allOpt.value = 'Todos';
    allOpt.textContent = 'Todos (mostrar todos)';
    sel.appendChild(allOpt);

    const items = Array.isArray(list) && list.length ? list : MUNICIPALITIES;
    // items may be strings or objects {name, center}
    const names = items.map(i => (typeof i === 'string' ? i : (i && i.name) || '')).filter(Boolean);
    // ensure unique and sorted
    const uniq = Array.from(new Set(names.map(n => n.trim()))).filter(Boolean).sort((a,b)=>a.localeCompare(b, 'pt-BR'));
    uniq.forEach(region => {
      const opt = document.createElement('option');
      opt.value = region;
      opt.textContent = region;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.warn('populateRegionOptions error', err);
  }
}

// Called by the inline map script once municipalities are loaded
window.registerMunicipalities = function (list) {
  try {
    if (!Array.isArray(list)) return;
    // Normalize to objects {name, center?}
    MUNICIPALITIES = list.map(item => (typeof item === 'string' ? { name: item } : item));
    populateRegionOptions(MUNICIPALITIES);
  } catch (err) {
    console.warn('registerMunicipalities error', err);
  }
};

function normalizeText(text) {
  return String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Map markers for birds grouped by municipality
let birdMarkersLayer = null;

function renderMapBirdMarkers(birds) {
  try {
    if (typeof window.map === 'undefined' || typeof L === 'undefined') return;
    if (!Array.isArray(birds)) birds = [];

    // clear previous layer
    if (birdMarkersLayer) {
      birdMarkersLayer.clearLayers();
    } else {
      birdMarkersLayer = L.layerGroup().addTo(window.map);
    }

    // Place one small marker per bird at the municipality center (with slight jitter to reduce exact overlap)
    const jitterOffset = 0.002; // degrees, small offset (~200m)
    birds.forEach(b => {
      const mun = String(b.region || '').trim();
      if (!mun) return;
      const key = normalizeText(mun);
      const match = (MUNICIPALITIES || []).find(m => normalizeText(m.name || m) === key);
      const center = match && match.center ? match.center : null;
      if (!center) return;

      const lat = center[0] + (Math.random() - 0.5) * jitterOffset;
      const lng = center[1] + (Math.random() - 0.5) * jitterOffset;
      const marker = L.circleMarker([lat, lng], { radius: 3, color: '#c53030', fillColor: '#c53030', fillOpacity: 0.95, weight: 0 });
      const popup = `<strong>${escapeHtml(String(b.name || '—'))}</strong><br>${escapeHtml(String(b.species || ''))}<br>${escapeHtml(String(b.locationFound || ''))}`;
      marker.bindPopup(popup);
      birdMarkersLayer.addLayer(marker);
    });
  } catch (err) {
    console.warn('renderMapBirdMarkers error', err);
  }
}

// Populate the top marquee with recent photos from the birds catalog
function populateMarquee(birds) {
  try {
    const track = document.querySelector('.marquee-track');
    if (!track) return;
    if (!Array.isArray(birds)) birds = [];

    // pick birds that have a photoUrl, newest first (by id if no timestamp)
    const withPhoto = birds.filter(b => b && (b.photoUrl || b.photo));
    const sorted = withPhoto.slice().sort((a, b) => {
      const ai = a.id || 0;
      const bi = b.id || 0;
      return bi - ai;
    });
    const items = sorted.slice(0, 10);
    if (!items.length) {
      // fallback: leave existing markup
      return;
    }

    const groupHtml = items.map(it => `
      <div class="marquee-item"><img src="${escapeHtml(safePhotoUrl(it.photoUrl || it.photo))}" alt="Foto de ${escapeHtml(it.name || 'pássaro')}" loading="lazy" /></div>
    `).join('');

    track.innerHTML = `
      <div class="marquee-group">${groupHtml}</div>
      <div class="marquee-group" aria-hidden="true">${groupHtml}</div>
    `;
  } catch (err) {
    console.warn('populateMarquee error', err);
  }
}

// small helper to avoid basic HTML injection in popup content
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c];
  });
}

function safePhotoUrl(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('/uploads/') || raw.startsWith('/assets/')) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.origin === window.location.origin)) {
      return parsed.href;
    }
  } catch (_) {}
  return '/assets/images/img-home.jpg';
}

const API = '/api/birds';
let allBirds = [];
let selectedRegion = 'Todos';
let isAdmin = false;

function setTheme(theme) {
  themeRoot.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggle.textContent = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
  if (typeof window.setMapTheme === 'function') {
    window.setMapTheme(theme);
  }
}

function loadTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  setTheme(theme);
}


async function fetchBirds() {
  try {
    const response = await fetch(API, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`Falha na API: ${response.status}`);
    const birds = await response.json();
    if (!Array.isArray(birds)) throw new Error('Resposta inválida da API.');
    allBirds = birds;
    // populate marquee with recent photos
    try { populateMarquee(allBirds); } catch (e) { /* ignore */ }
    filterBirds(selectedRegion);
  } catch (error) {
    birdGrid.innerHTML = '<p>Não foi possível carregar o catálogo. Atualize a página.</p>';
    console.error(error);
  }
}

function renderBirds(birds) {
  birdCount.textContent = birds.length;
  if (!birds.length) {
    birdGrid.innerHTML = '<p class="empty-state">Nenhum pássaro encontrado para esta região.</p>';
    return;
  }
  birdGrid.innerHTML = birds.map(bird => {
    const id = Number.isInteger(Number(bird.id)) ? Number(bird.id) : 0;
    return `
      <article class="card">
        <img src="${escapeHtml(safePhotoUrl(bird.photoUrl))}" alt="Foto de ${escapeHtml(bird.name)}" loading="lazy" />
        <div class="card-content">
          <h2>${escapeHtml(bird.name)}</h2>
          <div class="meta">Espécie: ${escapeHtml(bird.species)}</div>
          <div class="meta">Encontrado em: ${escapeHtml(bird.locationFound)}</div>
          <p>${escapeHtml(bird.description)}</p>
          <span class="tag">${escapeHtml(bird.region)}</span>
          <div class="card-actions">
            <button class="delete-btn" data-id="${id}" style="display:none">Excluir</button>
          </div>
        </div>
      </article>`;
  }).join('');

  document.querySelectorAll('#birdGrid .card').forEach(card => {
    if (revealObserver) {
      revealObserver.observe(card);
    } else {
      card.classList.add('visible');
    }
  });

  // attach delete handlers
  document.querySelectorAll('#birdGrid .delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (!id) return;
      deleteBird(Number(id));
    });
  });
  updateAdminUI();
  // update map markers to reflect the currently rendered birds
  try {
    if (typeof renderMapBirdMarkers === 'function') renderMapBirdMarkers(birds);
  } catch (e) {
    console.warn('Could not update map markers', e);
  }
}

function updateAdminUI() {
  document.querySelectorAll('#birdGrid .delete-btn').forEach(btn => {
    btn.style.display = isAdmin ? 'inline-block' : 'none';
  });
  if (adminPanel) {
    adminPanel.classList.toggle('visible', isAdmin);
  }
  if (adminButton && isAdminRoute) {
    adminButton.disabled = false;
    adminButton.textContent = isAdmin ? 'Sair do admin' : 'Entrar como admin';
  }
}

async function deleteBird(id) {
  if (!confirm('Confirma exclusão desta postagem?')) return;
  try {
    const res = await fetch(`/api/birds/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Falha ao excluir.');
      return;
    }
    await fetchBirds();
  } catch (err) {
    console.error('deleteBird error', err);
    alert('Erro ao excluir. Veja console.');
  }
}

function filterBirds(region) {
  selectedRegion = region;
  const filtered = (!region || region === 'Todos')
    ? allBirds
    : allBirds.filter(bird => String(bird.region || '').toLowerCase() === String(region).toLowerCase());
  renderBirds(filtered);
}

// Expose helpers for the map script (which runs inline in the page)
window.filterByRegion = function (region) {
  if (!region) return;
  try {
    filterBirds(region);
  } catch (err) {
    console.warn('filterByRegion error', err);
  }
};

window.assignRegionToForm = function (region) {
  if (!region) return;
  try {
    if (isAdmin) {
      // Se a opção existir no select, seleciona; caso contrário, avisa que não corresponde
      const sel = fields.region;
      if (sel) {
        const match = Array.from(sel.options).find(o => o.value.toLowerCase() === String(region).toLowerCase());
        if (match) {
          sel.value = match.value;
          adminStatus.textContent = 'Região selecionada no mapa: ' + match.value;
        } else {
          adminStatus.textContent = 'Região do mapa não corresponde às opções. Selecione manualmente.';
        }
      }
    } else {
      adminStatus.textContent = 'Clique em "Entrar como admin" para atribuir esta região.';
    }
  } catch (err) {
    console.warn('assignRegionToForm error', err);
  }
};

async function showAdminPanel() {
  const pin = prompt('Informe o PIN de acesso:');
  if (!pin) return;
  const password = prompt('Informe a senha de administrador:');
  if (!password) return;

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ pin: String(pin).trim(), password: String(password) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(result.message || 'Credenciais inválidas.');
      return;
    }
    isAdmin = true;
    adminStatus.textContent = 'Modo administrador ativado. Crie uma postagem abaixo.';
    updateAdminUI();
  } catch (error) {
    console.error('admin login error', error);
    alert('Não foi possível autenticar o administrador.');
  }
}

async function logoutAdmin() {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_) {}
  isAdmin = false;
  adminStatus.textContent = 'Sessão de administrador encerrada.';
  updateAdminUI();
}

async function checkAdminSession() {
  if (!isAdminRoute) return;
  try {
    const response = await fetch('/api/admin/status', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } });
    const result = response.ok ? await response.json() : { authenticated: false };
    isAdmin = Boolean(result.authenticated);
    if (isAdmin) adminStatus.textContent = 'Sessão de administrador ativa.';
  } catch (_) {
    isAdmin = false;
  }
  updateAdminUI();
}

async function addBird() {
  const imageFile = fields.photo.files[0];
  const formData = new FormData();

  formData.append('name', fields.name.value.trim());
  formData.append('species', fields.species.value.trim());
  formData.append('locationFound', fields.locationFound.value.trim());
  formData.append('region', fields.region.value.trim());
  formData.append('description', fields.description.value.trim());
  if (imageFile) {
    formData.append('photo', imageFile);
  }

  formMessage.textContent = '';
  formMessage.style.color = 'var(--text)';

  if (!isAdmin) {
    formMessage.textContent = 'Ação restrita a administradores. Faça login para continuar.';
    return;
  }

  if (!fields.name.value.trim() || !fields.species.value.trim() || !fields.locationFound.value.trim() || !fields.region.value.trim() || !fields.description.value.trim() || !imageFile) {
    formMessage.textContent = 'Preencha todos os campos e envie uma imagem.';
    return;
  }
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  if (!allowedTypes.has(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
    formMessage.textContent = 'Use uma imagem JPG, PNG, GIF ou WebP de até 5 MB.';
    return;
  }

  try {
    const response = await fetch(API, {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      formMessage.textContent = error.message || 'Erro ao enviar dados.';
      formMessage.style.color = '#dc2626';
      return;
    }

    await fetchBirds();
    formMessage.style.color = '#16a34a';
    formMessage.textContent = 'Postagem criada com sucesso!';
    // Reset fields: select region volta para 'Todos', outros campos limpos
    Object.values(fields).forEach(field => {
      try {
        if (!field) return;
        if (field === fields.region) {
          field.value = 'Todos';
        } else if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
          field.value = '';
        }
      } catch (e) {
        // ignore
      }
    });
  } catch (error) {
    formMessage.style.color = '#dc2626';
    formMessage.textContent = 'Ocorreu um erro ao salvar a postagem.';
    console.error(error);
  }
}

function enableFeedMode() {
  if (!birdGrid) return;
  document.body.classList.add('feed-mode');
  attachFeedHandlers();
  if (!document.querySelector('.scroll-exit-hint')) {
    const hint = document.createElement('div');
    hint.className = 'scroll-exit-hint';
    hint.textContent = 'Role para baixo / para cima. Pressione Esc para sair.';
    document.body.appendChild(hint);
    setTimeout(() => { hint.remove(); }, 4000);
  }
  if (feedToggle) {
    feedToggle.textContent = 'Sair do Feed';
  }
}

function disableFeedMode() {
  document.body.classList.remove('feed-mode');
  const indicator = document.querySelector('.feed-indicator');
  if (indicator) indicator.remove();
  const left = document.querySelector('.feed-nav-btn.left');
  const right = document.querySelector('.feed-nav-btn.right');
  if (left) left.remove();
  if (right) right.remove();
  if (feedToggle) {
    feedToggle.textContent = 'Modo Feed';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
  const current = themeRoot.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});
} else console.warn('themeToggle not found');

if (adminButton) {
  adminButton.addEventListener('click', () => { if (isAdmin) logoutAdmin(); else showAdminPanel(); });
} else console.warn('adminButton not found');

if (addBirdButton) {
  addBirdButton.addEventListener('click', addBird);
} else console.warn('addBirdButton not found');

if (btnView) {
  btnView.addEventListener('click', () => {
    if (birdGrid) birdGrid.scrollIntoView({ behavior: 'smooth' });
  });
} else console.warn('btnView not found');

if (feedToggle) {
  feedToggle.addEventListener('click', () => {
    if (document.body.classList.contains('feed-mode')) {
      disableFeedMode();
    } else {
      enableFeedMode();
      if (birdGrid) birdGrid.scrollIntoView({ behavior: 'smooth' });
    }
  });
} else console.warn('feedToggle not found');

// Allow exiting feed mode with Escape
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && document.body.classList.contains('feed-mode')) {
    document.body.classList.remove('feed-mode');
    // remove feed UI extras if present
    const indicator = document.querySelector('.feed-indicator');
    if (indicator) indicator.remove();
    const left = document.querySelector('.feed-nav-btn.left');
    const right = document.querySelector('.feed-nav-btn.right');
    if (left) left.remove();
    if (right) right.remove();
  }
});

// Mobile feed support: swipe navigation + page indicator
let feedHandlersAttached = false;
function attachFeedHandlers() {
  if (!birdGrid) return;

  function ensureNavButtons() {
    if (!document.querySelector('.feed-nav-btn.left')) {
      const left = document.createElement('button');
      left.className = 'feed-nav-btn left';
      left.innerHTML = '&#9664;';
      left.addEventListener('click', scrollToPrev);
      document.body.appendChild(left);
    }
    if (!document.querySelector('.feed-nav-btn.right')) {
      const right = document.createElement('button');
      right.className = 'feed-nav-btn right';
      right.innerHTML = '&#9654;';
      right.addEventListener('click', scrollToNext);
      document.body.appendChild(right);
    }
  }

  if (!feedHandlersAttached) {
    feedHandlersAttached = true;

    // create indicator
    function createIndicator() {
      if (document.querySelector('.feed-indicator')) return;
      const ind = document.createElement('div');
      ind.className = 'feed-indicator';
      ind.textContent = '';
      document.body.appendChild(ind);
      updateIndicator();
    }

    function updateIndicator() {
      const cards = document.querySelectorAll('#birdGrid .card');
      if (!cards || !cards.length) return;
      const grid = birdGrid;
      const idx = Math.round((grid.scrollTop || 0) / window.innerHeight);
      const clamped = Math.max(0, Math.min(idx, cards.length - 1));
      const ind = document.querySelector('.feed-indicator');
      if (ind) ind.textContent = `${clamped + 1}/${cards.length}`;
    }

    function scrollToIndex(i) {
      const cards = document.querySelectorAll('#birdGrid .card');
      if (!cards || !cards.length) return;
      const idx = Math.max(0, Math.min(i, cards.length - 1));
      birdGrid.scrollTo({ top: idx * window.innerHeight, behavior: 'smooth' });
      setTimeout(updateIndicator, 350);
    }

    function getCurrentIndex() {
      return Math.round((birdGrid.scrollTop || 0) / window.innerHeight);
    }

    function scrollToNext() { scrollToIndex(getCurrentIndex() + 1); }
    function scrollToPrev() { scrollToIndex(getCurrentIndex() - 1); }

    // touch swipe
    let touchStartY = 0;
    birdGrid.addEventListener('touchstart', (e) => {
      if (!document.body.classList.contains('feed-mode')) return;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    birdGrid.addEventListener('touchend', (e) => {
      if (!document.body.classList.contains('feed-mode')) return;
      const touchEndY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : 0;
      const dy = touchStartY - touchEndY;
      if (Math.abs(dy) > 60) {
        if (dy > 0) scrollToNext(); else scrollToPrev();
      }
    });

    // scroll end debounce to snap/update indicator
    let scrollTimeout = null;
    birdGrid.addEventListener('scroll', () => {
      if (!document.body.classList.contains('feed-mode')) return;
      createIndicator();
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // snap to nearest
        const idx = getCurrentIndex();
        scrollToIndex(idx);
        updateIndicator();
      }, 120);
    }, { passive: true });
  }

  ensureNavButtons();
}

document.querySelectorAll('.reveal').forEach(section => {
  if (revealObserver) {
    revealObserver.observe(section);
  } else {
    section.classList.add('visible');
  }
});

if (scrollDown) {
  scrollDown.addEventListener('click', () => {
    document.querySelector('.image-marquee').scrollIntoView({ behavior: 'smooth' });
  });
}

loadTheme();
populateRegionOptions();
checkAdminSession();
fetchBirds();
})();
