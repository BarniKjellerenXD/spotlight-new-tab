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

/* ── Init ── */
async function init() {
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

/* ── Search ── */
let searchTimeout = null;

function onSearchInput() {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();
  if (!query) { clearResults(); hideResults(); return; }
  showLoading();
  searchTimeout = setTimeout(() => performSearch(query), 80);
}

async function performSearch(query) {
  const lower = query.toLowerCase();
  let results = [];

  // 1. Web search pill — always first
  results.push({
    type: 'web', title: `Search "${query}" with your default search engine`,
    url: query, subtitle: 'Open in browser', isSearch: true,
  });

  // 2. Bookmarks
  results = results.concat(
    allBookmarks.filter((b) => b.title.toLowerCase().includes(lower) || b.url.toLowerCase().includes(lower))
      .slice(0, 8).map((b) => ({ type: 'bookmark', title: b.title, url: b.url, subtitle: b.url }))
  );

  // 3. Open Tabs
  results = results.concat(
    allTabs.filter((t) => t.title.toLowerCase().includes(lower) || t.url.toLowerCase().includes(lower))
      .slice(0, 5).map((t) => ({
        type: 'tab', title: t.title, url: t.url,
        subtitle: `Switch to tab — ${new URL(t.url).hostname}`,
        tabId: t.tabId, windowId: t.windowId, favIconUrl: t.favIconUrl,
      }))
  );

  // 4. History — last, least useful
  const hist = await loadHistory(query);
  results = results.concat(
    hist.slice(0, 8).map((h) => ({ type: 'history', title: h.title, url: h.url, subtitle: h.url }))
  );

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
    default:         return '•';
  }
}

function getTypeLabel(type) {
  switch (type) {
    case 'bookmark': return 'Bookmark';
    case 'history':  return 'History';
    case 'tab':      return 'Tab';
    case 'web':      return 'Web';
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
