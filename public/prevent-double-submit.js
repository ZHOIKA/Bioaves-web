(() => {
  'use strict';

  const button = document.getElementById('addBirdButton');
  if (!button || typeof window.fetch !== 'function') return;

  const originalFetch = window.fetch.bind(window);
  const originalLabel = button.textContent || 'Criar postagem';
  let createRequest = null;
  let unlockTimer = null;

  function lockButton() {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Publicando…';
  }

  function unlockButton() {
    if (unlockTimer) clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = originalLabel;
      unlockTimer = null;
    }, 1200);
  }

  function getMethod(input, init) {
    if (init && init.method) return String(init.method).toUpperCase();
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return String(input.method || 'GET').toUpperCase();
    }
    return 'GET';
  }

  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function isCreateBirdRequest(input, init) {
    const method = getMethod(input, init);
    if (method !== 'POST') return false;

    const rawUrl = getUrl(input);
    try {
      const url = new URL(rawUrl, window.location.origin);
      return url.origin === window.location.origin && url.pathname === '/api/birds';
    } catch (_) {
      return rawUrl === '/api/birds';
    }
  }

  window.fetch = function protectedFetch(input, init) {
    if (!isCreateBirdRequest(input, init)) {
      return originalFetch(input, init);
    }

    if (createRequest) {
      return createRequest.then((response) => response.clone());
    }

    lockButton();

    createRequest = originalFetch(input, init)
      .finally(() => {
        const finishedRequest = createRequest;
        setTimeout(() => {
          if (createRequest === finishedRequest) createRequest = null;
          unlockButton();
        }, 250);
      });

    return createRequest.then((response) => response.clone());
  };
})();
