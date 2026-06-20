/* =============================================
   SPOTLIGHT SEARCH — Background Service Worker
   ============================================= */

'use strict';

// Opens the spotlight search popup window
function openSpotlightWindow() {
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 680,
    height: 520,
  });
}

// Triggered by:
//  - Ctrl+E / Cmd+E (via _execute_action command)
//  - Clicking the extension toolbar icon
chrome.action.onClicked.addListener(() => {
  openSpotlightWindow();
});

// Listen for messages from the popup page
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'closeSpotlight') {
    // Close the popup window after a result is opened
    const winId = sender.tab?.windowId;
    if (winId) chrome.windows.remove(winId);
  }
});

console.log('✨ Spotlight Search: Service Worker ready');
