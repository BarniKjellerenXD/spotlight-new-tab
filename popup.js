/* =============================================
   SPOTLIGHT SEARCH — Popup Search Engine
   Compact version for Ctrl+E popup window
   ============================================= */

'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const searchInput   = $('#search-input');
const resultsList   = $('#results-list');
const resultsWrap   = $('#results-wrapper');
const resultsEmpty  = $('#results-empty');

let allBookmarks = [];
let allTabs      = [];
let activeIndex  = -1;
let currentResults = [];
let settings = {};

const DEFAULT_SETTINGS = {
  resultOrder: ['tabs', 'web', 'bookmarks', 'history'],
  customCommands: [],
};

/* ── Load settings from chrome.storage ── */
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('spotlightSettings', (data) => {
      settings = { ...DEFAULT_SETTINGS, ...(data.spotlightSettings || {}) };
      resolve();
    });
  });
}

/* ── Init ── */
async function init() {
  await loadSettings();

  await Promise.all([
    loadBookmarks(),
    loadTabs(),
  ]);

  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', onSearchKeydown);

  // Focus on load
  setTimeout(() => searchInput.focus(), 50);
}

/* ── Load Bookmarks ── */
function loadBookmarks() {
  return new Promise((resolve) => {
    try {
      chrome.bookmarks.getTree((tree) => {
        allBookmarks = flattenBookmarks(tree);
        resolve();
      });
    } catch { resolve(); }
  });
}

function flattenBookmarks(nodes, depth = 0) {
  let result = [];
  for (const node of nodes) {
    if (node.url) result.push({ title: node.title || node.url, url: node.url, depth });
    if (node.children) result = result.concat(flattenBookmarks(node.children, depth + 1));
  }
  return result;
}

/* ── Load Tabs ── */
function loadTabs() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({}, (tabs) => {
        allTabs = tabs.map((t) => ({
          title: t.title || 'Untitled', url: t.url || '',
          tabId: t.id, windowId: t.windowId, favIconUrl: t.favIconUrl || '',
        }));
        resolve();
      });
    } catch { resolve(); }
  });
}

/* ── Load History ── */
function loadHistory(query) {
  return new Promise((resolve) => {
    try {
      chrome.history.search({ text: query, maxResults: 25, startTime: 0 }, (results) => {
        resolve((results || []).map((h) => ({ title: h.title || h.url, url: h.url })));
      });
    } catch { resolve([]); }
  });
}

/* ── Command System ── */
const BUILTIN_COMMANDS = [
  {
    id: 'newtab', name: '/newtab', icon: '➕',
    description: 'Open a new tab. Add a query to search.',
    keyword: '/newtab',
    action: (args) => {
      const url = args ? `https://www.google.com/search?q=${encodeURIComponent(args)}` : 'about:blank';
      chrome.tabs.create({ url });
      closePopup();
    },
  },
  {
    id: 'newwindow', name: '/newwindow', icon: '🗔',
    description: 'Open a new window. Add a query to search.',
    keyword: '/newwindow',
    action: (args) => {
      const url = args ? `https://www.google.com/search?q=${encodeURIComponent(args)}` : 'about:blank';
      chrome.windows.create({ url });
      closePopup();
    },
  },
  {
    id: 'private', name: '/private', icon: '🕶️',
    description: 'Open an incognito window. Add a query to search.',
    keyword: '/private',
    action: (args) => {
      const url = args ? `https://www.google.com/search?q=${encodeURIComponent(args)}` : 'about:blank';
      chrome.windows.create({ url, incognito: true });
      closePopup();
    },
  },
];

function getAllCommands() {
  const builtins = [...BUILTIN_COMMANDS];
  const customs = (settings.customCommands || []).map((c) => ({
    id: `custom-${c.name}`,
    name: `/${c.name}`,
    icon: c.icon || '⚡',
    description: c.url.replace('{{query}}', '<query>'),
    keyword: `/${c.name}`,
    isCustom: true,
    action: (args) => {
      const url = c.url.replace('{{query}}', encodeURIComponent(args || ''));
      chrome.tabs.create({ url });
      closePopup();
    },
  }));
  return [...builtins, ...customs];
}

function isCommandInput(text) {
  return text.startsWith('/');
}

function performCommandSearch(input) {
  // Parse: /command arg1 arg2...
  const parts = input.split(' ');
  const cmdPart = parts[0].toLowerCase(); // e.g. "/newtab"
  const args = parts.slice(1).join(' ');  // everything after the command

  const all = getAllCommands();

  // If we have an exact match on a command with args provided, execute directly
  const exact = all.find((c) => c.keyword === cmdPart);
  if (exact && args) {
    // Show the command as the only result with its args displayed
    currentResults = [{
      type: 'command',
      command: exact,
      args: args,
      title: `${exact.icon}  ${exact.name} ${args}`,
      subtitle: exact.description,
    }];
    renderResults(currentResults);
    return;
  }

  // Filter commands by what user typed
  const matched = all.filter((c) => c.keyword.startsWith(cmdPart) || c.name.toLowerCase().includes(cmdPart.slice(1)));

  if (matched.length === 0) {
    // No matching commands — show "no results"
    currentResults = [];
    renderResults([]);
    return;
  }

  // Build result items
  currentResults = matched.map((cmd, i) => ({
    type: 'command',
    command: cmd,
    args: args,
    title: `${cmd.icon}  ${cmd.name}`,
    subtitle: cmd.description,
    isCommand: true,
    priority: cmdPart === cmd.keyword ? 0 : 1, // exact match first
  }));

  // Sort: exact matches first
  currentResults.sort((a, b) => (a.priority || 1) - (b.priority || 1));

  renderResults(currentResults);
}

/* ── Search ── */
let searchTimeout = null;

function onSearchInput() {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();

  if (!query) { clearResults(); hideResults(); return; }

  // Command mode — input starts with /
  if (isCommandInput(query)) {
    showLoading();
    searchTimeout = setTimeout(() => performCommandSearch(query), 50);
    return;
  }

  showLoading();
  searchTimeout = setTimeout(() => performSearch(query), 80);
}

async function performSearch(query) {
  const lower = query.toLowerCase();
  let results = [];
  const order = settings.resultOrder || ['tabs', 'web', 'bookmarks', 'history'];

  // Pre-load history if it's in the order
  let histResults = [];
  if (order.includes('history')) {
    const hist = await loadHistory(query);
    histResults = hist.slice(0, 8).map((h) => ({ type: 'history', title: h.title, url: h.url, subtitle: h.url }));
  }

  // Build results in configured order
  for (const source of order) {
    switch (source) {
      case 'web':
        results.push({
          type: 'web', title: `Search "${query}" with your default search engine`,
          url: query, subtitle: 'Open in browser', isSearch: true,
        });
        break;
      case 'bookmarks':
        results = results.concat(
          allBookmarks.filter((b) => b.title.toLowerCase().includes(lower) || b.url.toLowerCase().includes(lower))
            .slice(0, 8).map((b) => ({ type: 'bookmark', title: b.title, url: b.url, subtitle: b.url }))
        );
        break;
      case 'tabs':
        results = results.concat(
          allTabs.filter((t) => t.title.toLowerCase().includes(lower) || t.url.toLowerCase().includes(lower))
            .slice(0, 5).map((t) => ({
              type: 'tab', title: t.title, url: t.url,
              subtitle: `Switch to tab — ${new URL(t.url).hostname}`,
              tabId: t.tabId, windowId: t.windowId, favIconUrl: t.favIconUrl,
            }))
        );
        break;
      case 'history':
        results = results.concat(histResults);
        break;
    }
  }

  // Deduplicate
  const seen = new Set();
  currentResults = results.filter((r) => {
    const key = `${r.type}:${r.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  activeIndex = -1;
  renderResults(currentResults);
}

/* ── Render ── */
function renderResults(results) {
  resultsList.innerHTML = '';
  if (results.length === 0) {
    resultsWrap.classList.add('visible');
    resultsEmpty.classList.add('visible');
    resultsList.classList.remove('loading');
    return;
  }

  resultsEmpty.classList.remove('visible');
  resultsWrap.classList.add('visible');
  resultsList.classList.remove('loading');

  for (const r of results) {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.dataset.index = currentResults.indexOf(r);

    const icon = document.createElement('span');
    icon.className = 'result-icon';
    if (r.type === 'tab' && r.favIconUrl) {
      const img = document.createElement('img');
      img.src = r.favIconUrl;
      img.className = 'result-icon favicon';
      img.width = 16; img.height = 16;
      img.onerror = () => { icon.textContent = getIcon(r.type); };
      icon.appendChild(img);
    } else if (r.type === 'command' && r.command?.icon) {
      icon.textContent = r.command.icon;
      icon.style.fontSize = '16px';
    } else {
      icon.textContent = getIcon(r.type);
    }
    li.appendChild(icon);

    const content = document.createElement('div');
    content.className = 'result-content';
    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = r.title;
    content.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'result-url';
    subtitle.textContent = r.subtitle || r.url;
    content.appendChild(subtitle);
    li.appendChild(content);

    const badge = document.createElement('span');
    badge.className = `result-type result-type-${r.type}`;
    badge.textContent = getTypeLabel(r.type);
    li.appendChild(badge);

    if (r.isSearch) {
      const searchBtn = document.createElement('span');
      searchBtn.className = 'result-search-term';
      searchBtn.textContent = '↗ Search';
      li.appendChild(searchBtn);
    }

    li.addEventListener('click', () => activateResult(r));
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('mouseenter', () => setActive(currentResults.indexOf(r)));

    resultsList.appendChild(li);
  }

  if (results.length > 0) setActive(0);
}

function getIcon(type) {
  switch (type) {
    case 'bookmark': return '★';
    case 'history':  return '↻';
    case 'tab':      return '▣';
    case 'web':      return '↗';
    case 'command':  return '⌘';
    default:         return '•';
  }
}

function getTypeLabel(type) {
  switch (type) {
    case 'bookmark': return 'Bookmark';
    case 'history':  return 'History';
    case 'tab':      return 'Tab';
    case 'web':      return 'Web';
    case 'command':  return 'Command';
    default:         return type;
  }
}

/* ── Navigation ── */
function setActive(index) {
  $$('.result-item').forEach((el) => el.classList.remove('active'));
  activeIndex = index;
  const el = $$('.result-item')[index];
  if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest' }); }
}

function onSearchKeydown(e) {
  const items = $$('.result-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActive(Math.min(activeIndex + 1, currentResults.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActive(Math.max(activeIndex - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const r = currentResults[activeIndex];
    if (r) {
      if (e.metaKey || e.ctrlKey) {
        openInNewTab(r);
      } else {
        activateResult(r);
      }
    }
  } else if (e.key === 'Escape') {
    closePopup();
  }
}

/* ── Close (handles both iframe overlay & standalone window) ── */
function closePopup() {
  if (window !== window.top) {
    // Running inside the content script's iframe overlay
    window.parent.postMessage({ action: 'spotlight-close' }, '*');
  } else {
    // Standalone popup window
    try {
      chrome.runtime.sendMessage({ action: 'closeSpotlight' });
    } catch {
      window.close();
    }
  }
}

// Listen for focus messages from the content script (re-open while already open)
window.addEventListener('message', (event) => {
  if (event.data.action === 'spotlight-focus') {
    searchInput.focus();
  }
});

/* ── Activate ── */
function activateResult(r) {
  // Commands
  if (r.type === 'command' && r.command?.action) {
    r.command.action(r.args || '');
    return;
  }

  if (r.isSearch) {
    chrome.search.query({ text: r.url });
    closePopup();
    return;
  }

  if (r.type === 'tab') {
    chrome.tabs.update(r.tabId, { active: true });
    chrome.windows.update(r.windowId, { focused: true });
    closePopup();
    return;
  }

  // Navigate an existing tab or create one
  chrome.tabs.create({ url: r.url });
  closePopup();
}

function openInNewTab(r) {
  if (r.isSearch) {
    chrome.search.query({ text: r.url });
  } else {
    chrome.tabs.create({ url: r.url });
  }
  closePopup();
}

/* ── Clear / Hide ── */
function clearResults() {
  resultsList.innerHTML = '';
  currentResults = [];
  activeIndex = -1;
}

function hideResults() {
  resultsWrap.classList.remove('visible');
  resultsEmpty.classList.remove('visible');
}

function showLoading() {
  resultsList.classList.add('loading');
  resultsWrap.classList.add('visible');
}

/* ── Start ── */
document.addEventListener('DOMContentLoaded', init);
