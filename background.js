/* =============================================
   SPOTLIGHT SEARCH — Background Service Worker
   ============================================= */

'use strict';

// Triggered by Ctrl+E / Cmd+E (via open-spotlight command)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-spotlight') {
    injectOverlay();
  }
});

// Also works when clicking the toolbar icon
chrome.action.onClicked.addListener(() => {
  injectOverlay();
});

async function injectOverlay() {
  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;

  // Don't open on chrome:// or brave:// pages (privileged)
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('brave://') || tab.url?.startsWith('edge://')) {
    return;
  }

  try {
    // Try to ping the content script first to see if it's already loaded
    await chrome.tabs.sendMessage(tab.id, { action: 'spotlight-ping' });

    // Already injected — tell it to focus/re-open
    chrome.tabs.sendMessage(tab.id, { action: 'spotlight-toggle' });
  } catch {
    // Not injected yet — inject it now
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    } catch (err) {
      console.error('Spotlight: Failed to inject overlay', err);
    }
  }
}

console.log('✨ Spotlight Search: Service Worker ready');
