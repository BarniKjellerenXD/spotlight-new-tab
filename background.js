/* =============================================
   SPOTLIGHT NEW TAB — Background Service Worker
   ============================================= */

'use strict';

// Open spotlight popup window when Ctrl+E / Cmd+E is pressed
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-spotlight') {
    openSpotlightWindow();
  }
});

// Also open when the extension icon is clicked (if popup.html fails)
chrome.action.onClicked.addListener(() => {
  openSpotlightWindow();
});

function openSpotlightWindow() {
  // Calculate a centered position
  // Note: service workers don't have screen.width, so we use reasonable defaults
  const width = 680;
  const height = 520;

  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: width,
    height: height,
    left: Math.round((1920 - width) / 2),   // fallback center
    top: Math.round((1080 - height) / 3),
  });
}

// Listen for messages from popup or newtab pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Close the popup window when a result is activated
  if (message.action === 'closeSpotlight') {
    chrome.windows.remove(sender.tab?.windowId);
  }
});

console.log('✨ Spotlight Search: Service Worker ready');
