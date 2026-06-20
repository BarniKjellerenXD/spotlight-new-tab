<div align="center">
  <img src="icons/icon128.png" width="64" height="64" alt="Spotlight New Tab logo" />
  <h1>Spotlight New Tab ✦</h1>
  <p>A beautiful spotlight-style search overlay for your new tab page.</p>
  <p>Search bookmarks, history, open tabs, and the web — instantly.</p>
  <br/>
  <img src="https://img.shields.io/badge/Manifest-v3-blue" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"/>
</div>

<br/>

Inspired by **Zen Browser's spotlight** and **Vivaldi's Ctrl+E** quick search.

https://github.com/user-attachments/assets/5aa002f3-3b15-4088-8fdd-0d65e8b5a265

## ✨ Features

| | |
|---|---|
| **🔍 Unified Search** | Type anything and instantly search across bookmarks, history, open tabs, and the web |
| **⚡ Keyboard-First** | Navigate with `↑↓`, open with `↵`, open in new tab with `⌘↵`. No mouse needed |
| **🏠 Quick Links** | Your most-visited sites appear as glassmorphism tiles when the search is empty |
| **🎨 Glassmorphism Design** | Dark blurred backdrop, accent glow, smooth animations |
| **⚙️ Customizable** | Toggle search sources, background blur, and time/date display |
| **⌨️ Keyboard Shortcuts** | `⌘K` to focus search, `⌘B` for bookmarks, `⌘H` for history, `Esc` to clear |
| **🔒 Privacy-First** | All data stays local. No analytics, no tracking, no data transmitted anywhere |

## 🚀 Installation

### From Source (Developer Mode)

1. Clone the repo:
   ```bash
   git clone https://github.com/BarniKjellerenXD/spotlight-new-tab.git
   ```
2. Open **`chrome://extensions`** (or `brave://extensions`, `edge://extensions`)
3. Enable **Developer mode** (top-right toggle)
4. Click **"Load unpacked"** and select the repo folder

### From Chrome Web Store

*Coming soon — pending publication.*

## ⌨️ Usage

| Key | Action |
|---|---|
| `Type anything` | Search bookmarks, history, and open tabs |
| `↑` `↓` | Navigate through results |
| `↵` | Open selected result |
| `⌘` `↵` / `Ctrl` `↵` | Open in new tab |
| `⌘` `K` / `Ctrl` `K` | Focus the search bar |
| `Esc` | Clear search / close |
| `⌘` `B` / `Ctrl` `B` | Browse bookmarks |
| `⌘` `H` / `Ctrl` `H` | Browse history |

## ⚙️ Settings

Click the gear icon (bottom-left) to open the settings panel:

- Toggle search sources: **Bookmarks**, **History**, **Tabs**, **Web Search**
- Toggle **Most Visited** quick links on the new tab page
- Toggle **Background blur** effect
- Toggle **Time & Date** display
- All settings persist via `chrome.storage.local`

## 🧩 Permissions

| Permission | Why it's needed |
|---|---|
| `bookmarks` | To search your bookmarks |
| `history` | To search your browsing history |
| `tabs` | To find and switch to open tabs |
| `topSites` | To show most-visited sites as quick links |
| `storage` | To save your settings locally |
| `search` | To trigger web searches via your default search engine |

**All processing is local.** No data is sent to any server.

## 🛠️ Built With

- Manifest V3 — Chrome Extension API
- Vanilla JS — No frameworks, no dependencies
- CSS Glassmorphism — Backdrop blur, saturate, transparent overlays

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
  Made with 🎩 by <a href="https://github.com/BarniKjellerenXD">BarniKjellerenXD</a>
</div>
