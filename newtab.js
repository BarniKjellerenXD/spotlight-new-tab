/* =============================================
   SPOTLIGHT NEW TAB — Search Engine
   ============================================= */

'use strict';

/* ── DOM refs ── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const searchInput   = $('#search-input');
const resultsList   = $('#results-list');
const resultsWrap   = $('#results-wrapper');
const resultsEmpty  = $('#results-empty');
const quickLinks    = $('#quick-links');
const quickWrapper  = $('#quick-links-wrapper');
const timeEl        = $('#time');
const dateEl        = $('#date');
const timeOverlay   = $('#time-overlay');
const settingsBtn   = $('#settings-btn');
const settingsPanel = $('#settings-panel');

/* ── State ── */
let allBookmarks = [];
let allHistory   = [];
let allTabs      = [];
let allTopSites  = [];
let activeIndex  = -1;
let currentResults = [];
let sources = {};
let settings = {};

/* ── Default settings ── */
const DEFAULT_SETTINGS = {
  bookmarks: true,
  history:   true,
  tabs:      true,
  web:       true,
  topSites:  true,
  blur:      true,
  showTime:  true,
};

/* ── Settings ── */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('spotlightSettings', (data) => {
      settings = { ...DEFAULT_SETTINGS, ...(data.spotlightSettings || {}) };
      applySettings();
      resolve();
    });
  });
}

function saveSettings() {
  chrome.storage.local.set({ spotlightSettings: settings });
  applySettings();
}

function applySettings() {
  Object.assign(sources, {
    bookmarks: settings.bookmarks,
    history:   settings.history,
    tabs:      settings.tabs,
    web:       settings.web,
  });

  // Blur toggle
  document.body.style.setProperty(
    '--blur-active',
    settings.blur ? 'blur(24px)' : 'none'
  );

  // Time toggle
  timeOverlay.classList.toggle('hidden', !settings.showTime);

  // Quick links / Most visited
  if (settings.topSites && searchInput.value.trim() === '') {
    quickWrapper.style.display = '';
  } else {
    quickWrapper.style.display = 'none';
  }
}

/* ── Keyboard shortcuts ── */
const SHORTCUTS = {
  'ctrl+b': () => { searchInput.value = ''; focusSearch(); scrollTo(0,0); },
  'ctrl+h': () => { searchInput.value = ''; focusSearch(); scrollTo(0,0); },
};

/* ── Init ── */
async function init() {
  await loadSettings();

  // Load data in parallel
  await Promise.all([
    loadBookmarks(),
    loadTabs(),
    loadTopSites(),
  ]);

  // Show time
  updateTime();
  setInterval(updateTime, 1000);

  // Render quick links
  renderQuickLinks();

  // Start listening
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', onSearchKeydown);
  searchInput.addEventListener('blur', () => setTimeout(hideResults, 200));

  // Settings
  settingsBtn.addEventListener('click', openSettings);
  $$('#settings-panel input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', onSettingChange);
  });
  $('#settings-close').addEventListener('click', closeSettings);
  settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) closeSettings();
  });

  // Keyboard shortcut to open search (Cmd/Ctrl+K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      focusSearch();
    }
    if (e.key === 'Escape') {
      if (settingsPanel.classList.contains('open')) {
        closeSettings();
      } else if (searchInput.value) {
        searchInput.value = '';
        clearResults();
        focusSearch();
      }
    }
  });

  // Focus on load
  focusSearch();
}

/* ── Time ── */
function updateTime() {
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

/* ── Focus ── */
function focusSearch() {
  searchInput.focus();
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
    if (node.url) {
      result.push({ title: node.title || node.url, url: node.url, depth });
    }
    if (node.children) {
      result = result.concat(flattenBookmarks(node.children, depth + 1));
    }
  }
  return result;
}

/* ── Load Tabs ── */
function loadTabs() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({}, (tabs) => {
        allTabs = tabs.map((t) => ({
          title: t.title || 'Untitled',
          url: t.url || '',
          tabId: t.id,
          windowId: t.windowId,
          favIconUrl: t.favIconUrl || '',
        }));
        resolve();
      });
    } catch { resolve(); }
  });
}

/* ── Load Top Sites ── */
function loadTopSites() {
  return new Promise((resolve) => {
    try {
      chrome.topSites.get((sites) => {
        allTopSites = (sites || []).map((s) => ({
          title: s.title || s.url,
          url: s.url,
        }));
        resolve();
      });
    } catch { resolve(); }
  });
}

/* ── Load History (on search trigger) ── */
function loadHistory(query) {
  return new Promise((resolve) => {
    try {
      chrome.history.search({
        text: query,
        maxResults: 25,
        startTime: 0,
      }, (results) => {
        resolve((results || []).map((h) => ({
          title: h.title || h.url,
          url: h.url,
          lastVisitTime: h.lastVisitTime,
          visitCount: h.visitCount,
        })));
      });
    } catch { resolve([]); }
  });
}

/* ── Search Logic ── */
let searchTimeout = null;

function onSearchInput() {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();

  if (!query) {
    clearResults();
    hideResults();
    if (settings.topSites) quickWrapper.style.display = '';
    return;
  }

  quickWrapper.style.display = 'none';
  showLoading();

  searchTimeout = setTimeout(() => performSearch(query), 80);
}

async function performSearch(query) {
  const lower = query.toLowerCase();
  let results = [];

  // 1. Web search — always first
  if (sources.web) {
    results.push({
      type: 'web',
      title: `Search "${query}" with your default search engine`,
      url: query,
      subtitle: 'Open in browser',
      isSearch: true,
    });
  }

  // 2. Bookmarks
  if (sources.bookmarks) {
    const matches = allBookmarks.filter((b) =>
      b.title.toLowerCase().includes(lower) ||
      b.url.toLowerCase().includes(lower)
    ).slice(0, 8).map((b) => ({
      type: 'bookmark',
      title: b.title,
      url: b.url,
      subtitle: b.url,
    }));
    results = results.concat(matches);
  }

  // 3. Open Tabs
  if (sources.tabs) {
    const matches = allTabs.filter((t) =>
      t.title.toLowerCase().includes(lower) ||
      t.url.toLowerCase().includes(lower)
    ).slice(0, 5).map((t) => ({
      type: 'tab',
      title: t.title,
      url: t.url,
      subtitle: `Switch to tab — ${new URL(t.url).hostname}`,
      tabId: t.tabId,
      windowId: t.windowId,
      favIconUrl: t.favIconUrl,
    }));
    results = results.concat(matches);
  }

  // 4. History — last, least useful
  if (sources.history) {
    const hist = await loadHistory(query);
    const matches = hist.slice(0, 8).map((h) => ({
      type: 'history',
      title: h.title,
      url: h.url,
      subtitle: h.url,
    }));
    results = results.concat(matches);
  }

  // Deduplicate by URL
  const seen = new Set();
  currentResults = results.filter((r) => {
    // Allow duplicates of different types — but dedupe same-type+same-url
    const key = `${r.type}:${r.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  activeIndex = -1;
  renderResults(currentResults);
}

/* ── Render Results ── */
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

    // Icon
    const icon = document.createElement('span');
    icon.className = 'result-icon';
    if (r.type === 'tab' && r.favIconUrl) {
      const img = document.createElement('img');
      img.src = r.favIconUrl;
      img.className = 'result-icon favicon';
      img.width = 18;
      img.height = 18;
      img.onerror = () => { icon.textContent = getIcon(r.type); };
      icon.appendChild(img);
    } else {
      icon.textContent = getIcon(r.type);
    }
    li.appendChild(icon);

    // Content
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

    // Type badge
    const badge = document.createElement('span');
    badge.className = `result-type result-type-${r.type}`;
    badge.textContent = getTypeLabel(r.type);
    li.appendChild(badge);

    // Web search button
    if (r.isSearch) {
      const searchBtn = document.createElement('span');
      searchBtn.className = 'result-search-term';
      searchBtn.textContent = '↗ Search';
      li.appendChild(searchBtn);
    }

    li.addEventListener('click', () => activateResult(r));
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('mouseenter', () => {
      setActive(currentResults.indexOf(r));
    });

    resultsList.appendChild(li);
  }

  // Auto-select first
  if (results.length > 0) {
    setActive(0);
  }
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
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({ block: 'nearest' });
  }
}

function onSearchKeydown(e) {
  const items = $$('.result-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = Math.min(activeIndex + 1, currentResults.length - 1);
    setActive(next);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = Math.max(activeIndex - 1, 0);
    setActive(prev);
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
    if (searchInput.value) {
      searchInput.value = '';
      clearResults();
      hideResults();
      if (settings.topSites) quickWrapper.style.display = '';
    }
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault();
    loadBookmarks();
    searchInput.value = '';
    focusSearch();
    // Could show bookmark list
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
    e.preventDefault();
    searchInput.value = '';
    focusSearch();
    // Could show history
  }
}

/* ── Activate Result ── */
function activateResult(r) {
  if (r.isSearch) {
    // Perform web search
    chrome.search.query({ text: r.url });
    closeTab();
    return;
  }

  if (r.type === 'tab') {
    chrome.tabs.update(r.tabId, { active: true });
    chrome.windows.update(r.windowId, { focused: true });
    closeTab();
    return;
  }

  // Bookmark / history — navigate current tab
  chrome.tabs.update({ url: r.url });
  closeTab();
}

function openInNewTab(r) {
  if (r.type === 'tab') {
    // Duplicate tab?
    chrome.tabs.create({ url: r.url });
  } else if (r.isSearch) {
    chrome.search.query({ text: r.url });
  } else {
    chrome.tabs.create({ url: r.url });
  }
}

/* ── Close new tab after navigation ── */
function closeTab() {
  // If we navigated the new tab, no need to close it.
  // If we opened in a new tab, the new tab page stays — we'll leave it.
  // Actually, if user opens a bookmark, we navigate this tab, so it's fine.
  // The new tab page is replaced by the destination.
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

/* ── Quick Links (Most Visited) ── */
function renderQuickLinks() {
  quickLinks.innerHTML = '';

  if (!allTopSites.length) {
    // Fallback to top bookmarks
    const top = allBookmarks.slice(0, 8);
    for (const b of top) {
      quickLinks.appendChild(createQuickLink(b.title, b.url));
    }
    return;
  }

  for (const site of allTopSites.slice(0, 12)) {
    quickLinks.appendChild(createQuickLink(site.title, site.url));
  }
}

function createQuickLink(title, url) {
  const a = document.createElement('a');
  a.className = 'quick-link';
  a.href = url;
  a.title = url;

  const img = document.createElement('img');
  img.src = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  img.width = 18;
  img.height = 18;
  img.loading = 'lazy';
  img.onerror = () => {
    img.style.display = 'none';
    const fallback = document.createElement('span');
    fallback.textContent = title.charAt(0).toUpperCase();
    fallback.style.cssText = 'width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#8e8ea0;';
    a.insertBefore(fallback, img);
    img.remove();
  };
  a.appendChild(img);

  const span = document.createElement('span');
  span.textContent = title;
  a.appendChild(span);

  a.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.update({ url });
  });

  return a;
}

/* ── Settings Panel ── */
function openSettings() {
  // Sync checkboxes
  $('#toggle-bookmarks').checked = settings.bookmarks;
  $('#toggle-history').checked   = settings.history;
  $('#toggle-tabs').checked      = settings.tabs;
  $('#toggle-web').checked       = settings.web;
  $('#toggle-topSites').checked  = settings.topSites;
  $('#toggle-blur').checked      = settings.blur;
  $('#toggle-time').checked      = settings.showTime;

  settingsPanel.classList.add('open');
}

function closeSettings() {
  settingsPanel.classList.remove('open');
  focusSearch();
}

function onSettingChange(e) {
  const map = {
    'toggle-bookmarks': 'bookmarks',
    'toggle-history':   'history',
    'toggle-tabs':      'tabs',
    'toggle-web':       'web',
    'toggle-topSites':  'topSites',
    'toggle-blur':      'blur',
    'toggle-time':      'showTime',
  };
  const key = map[e.target.id];
  if (key) {
    settings[key] = e.target.checked;
    saveSettings();
    renderQuickLinks();
    // Re-run search if there's a query
    if (searchInput.value.trim()) {
      performSearch(searchInput.value.trim());
    }
  }
}

/* ── Start ── */
document.addEventListener('DOMContentLoaded', init);
