/* =============================================
   SPOTLIGHT SEARCH — Page Overlay
   Injected into the active tab on Ctrl+E
   ============================================= */

'use strict';

// Prevent double-injection
if (window.__spotlightOverlayActive) {
  // Already open — focus the search input inside the iframe
  document.getElementById('spotlight-overlay')?.querySelector('iframe')
    ?.contentWindow?.postMessage({ action: 'spotlight-focus' }, '*');
  throw new Error('Overlay already active');
}
window.__spotlightOverlayActive = true;

// ── Create overlay ──
const overlay = document.createElement('div');
overlay.id = 'spotlight-overlay';
overlay.innerHTML = `
  <div id="spotlight-backdrop"></div>
  <div id="spotlight-glass">
    <div id="spotlight-glass-bar"></div>
    <iframe id="spotlight-iframe" src="${chrome.runtime.getURL('popup.html')}" frameborder="0"></iframe>
  </div>
`;

// ── Inject styles ──
const style = document.createElement('style');
style.textContent = `
  #spotlight-overlay {
    all: initial;
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: flex-start !important;
    justify-content: center !important;
    padding-top: 12vh !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    pointer-events: auto !important;
  }

  #spotlight-backdrop {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.55) !important;
    backdrop-filter: blur(6px) !important;
    -webkit-backdrop-filter: blur(6px) !important;
    animation: spotlightFadeIn 0.15s ease-out !important;
  }

  @keyframes spotlightFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  #spotlight-glass {
    position: relative !important;
    width: 620px !important;
    max-width: 90vw !important;
    max-height: 70vh !important;
    background: rgba(18, 18, 24, 0.75) !important;
    backdrop-filter: blur(28px) saturate(1.5) !important;
    -webkit-backdrop-filter: blur(28px) saturate(1.5) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 16px !important;
    box-shadow:
      0 16px 64px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(108, 108, 255, 0.08) !important;
    animation: spotlightSlideDown 0.18s cubic-bezier(0.22, 1, 0.36, 1) !important;
    overflow: hidden !important;
  }

  #spotlight-glass-bar {
    position: absolute !important;
    top: 0 !important;
    left: 10% !important;
    right: 10% !important;
    height: 1px !important;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent) !important;
    z-index: 1 !important;
  }

  @keyframes spotlightSlideDown {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  #spotlight-iframe {
    width: 100% !important;
    height: 100% !important;
    min-height: 400px !important;
    max-height: 65vh !important;
    display: block !important;
    background: transparent !important;
  }
`;

document.documentElement.appendChild(style);
document.documentElement.appendChild(overlay);

// ── Listen for messages from the iframe ──
window.addEventListener('message', (event) => {
  // Only accept messages from our own iframe
  const iframe = document.getElementById('spotlight-iframe');
  if (event.source !== iframe?.contentWindow) return;

  switch (event.data.action) {
    case 'spotlight-close':
      removeOverlay();
      break;
  }
});

// ── Click backdrop to close ──
overlay.querySelector('#spotlight-backdrop').addEventListener('click', removeOverlay);

// ── Cleanup ──
function removeOverlay() {
  overlay.remove();
  style.remove();
  window.__spotlightOverlayActive = false;
}

// ── Handle Esc from within the overlay ──
// The iframe will send spotlight-close when Esc is pressed
// We also listen for direct Esc in case focus leaks
document.addEventListener('keydown', function handleEsc(e) {
  if (e.key === 'Escape') {
    removeOverlay();
    document.removeEventListener('keydown', handleEsc);
  }
});

console.log('✨ Spotlight overlay injected');
