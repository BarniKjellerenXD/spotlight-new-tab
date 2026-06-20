/* =============================================
   SPOTLIGHT SEARCH — Background Service Worker
   ============================================= */

'use strict';

// Triggered by Ctrl+E / Cmd+E (via _execute_action command)
// or by clicking the extension toolbar icon
chrome.action.onClicked.addListener(async (tab) => {
  // Don't open on chrome:// pages (they're privileged)
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('brave://') || tab.url?.startsWith('edge://')) {
    return;
  }

  try {
    // Check if the content script is already loaded by trying to send a message
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'spotlight-ping' });
      // Content script is already loaded — just tell it to open
      chrome.tabs.sendMessage(tab.id, { action: 'spotlight-toggle' });
      return;
    } catch {
      // Not loaded yet — inject it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    }
  } catch (err) {
    console.error('Spotlight: Failed to inject overlay', err);
  }
});

// Listen for search requests from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'spotlight-ping':
      sendResponse({ ok: true });
      break;
  }
});

console.log('✨ Spotlight Search: Service Worker ready');
