/* =============================================
   SPOTLIGHT SEARCH — Page Overlay
   Injected into the active tab on Ctrl+E
   ============================================= */

'use strict';

// Prevent double-injection
if (window.__spotlightOverlayActive) {
  throw new Error('Overlay already active');
}
window.__spotlightOverlayActive = true;

/* ── Background message handler ── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'spotlight-ping') {
    sendResponse({ ok: true });
    return true;
  }
  if (msg.action === 'spotlight-toggle') {
    if (document.getElementById('spotlight-overlay')) {
      // Overlay open — focus search
      document.getElementById('spotlight-overlay')
        ?.querySelector('iframe')
        ?.contentWindow?.postMessage({ action: 'spotlight-focus' }, '*');
    } else {
      // Overlay dismissed — rebuild
      buildOverlay();
    }
  }
});

/* ── CSS (injected once) ── */
const STYLES = `
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
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(108, 108, 255, 0.08) !important;
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
    from { opacity: 0; transform: translateY(-20px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
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

/* ── Build overlay ── */
function buildOverlay() {
  // Remove leftover
  document.getElementById('spotlight-overlay')?.remove();

  // Styles (once)
  if (!document.getElementById('spotlight-styles')) {
    const s = document.createElement('style');
    s.id = 'spotlight-styles';
    s.textContent = STYLES;
    document.documentElement.appendChild(s);
  }

  // Overlay div
  const overlay = document.createElement('div');
  overlay.id = 'spotlight-overlay';
  overlay.innerHTML = `
    <div id="spotlight-backdrop"></div>
    <div id="spotlight-glass">
      <div id="spotlight-glass-bar"></div>
      <iframe id="spotlight-iframe" src="${chrome.runtime.getURL('popup.html')}" frameborder="0"></iframe>
    </div>
  `;

  document.documentElement.appendChild(overlay);

  // Click backdrop to close
  overlay.querySelector('#spotlight-backdrop').addEventListener('click', () => {
    overlay.remove();
  });
}

/* ── Persistent Esc listener (once) ── */
document.addEventListener('keydown', function handleEsc(e) {
  if (e.key === 'Escape') {
    const el = document.getElementById('spotlight-overlay');
    if (el) el.remove();
  }
});

/* ── Listen for messages from the iframe ── */
window.addEventListener('message', (event) => {
  const iframe = document.getElementById('spotlight-iframe');
  if (event.source !== iframe?.contentWindow) return;
  if (event.data.action === 'spotlight-close') {
    const el = document.getElementById('spotlight-overlay');
    if (el) el.remove();
  }
});

/* ── Go! ── */
buildOverlay();
