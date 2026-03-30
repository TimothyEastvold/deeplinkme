# Claude Deeplink Chrome Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that captures page context (selected text, image URLs, full-page Markdown via pure.md) and launches a Claude Code session in WezTerm/WSL via the existing `claude-cli://` protocol chain.

**Architecture:** The extension captures selection via a content script, composes a prompt in a popup UI, then navigates to the GitHub relay page (`https://timothyeastvold.github.io/cc/`) with assembled params. Short context is inlined in `q=`; full-page Markdown is always passed as `content=` (base64), which the updated PowerShell script writes to `/tmp/cc-context.md` in the target WSL distro before launching Claude Code. The relay page and PowerShell script both need minor updates to support the new `content` param.

**Tech Stack:** Chrome Extension MV3, Vanilla JS (no frameworks — extension popups are tiny), Jest for unit tests on pure logic functions, manual browser testing for extension behavior.

---

## Repo Structure

```
deeplinkme/
  extension/
    manifest.json
    background.js
    content.js
    popup.html
    popup.js
    popup.css
    settings.html
    settings.js
    settings.css
    icons/
      icon16.png
      icon48.png
      icon128.png
  relay/
    index.html          ← updated copy of timothyeastvold.github.io/cc/
  scripts/
    claude-deeplink.ps1 ← updated to handle content= param
  docs/plans/
  tests/
    unit/
      assemble-deeplink.test.js
      encode-content.test.js
      settings-store.test.js
```

---

## Existing Infrastructure (do not break)

- **Relay page:** `https://timothyeastvold.github.io/cc/` — accepts `?q=&distro=&path=`, auto-fires `claude-cli://`
- **PS script:** `C:\Users\TimothyEastvold\scripts\claude-deeplink.ps1` — parses `claude-cli://` URI, launches WezTerm → WSL → claude
- **Protocol:** `claude-cli://open?q={prompt}&distro={wsl-distro}&path={linux-path}`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/icons/` (placeholder PNGs)
- Create: `tests/unit/.gitkeep`
- Create: `package.json` (Jest config)

**Step 1: Create package.json for Jest**

```json
{
  "name": "claude-deeplink-extension",
  "version": "1.0.0",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/unit/**/*.test.js"]
  }
}
```

Run: `npm install`

**Step 2: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Claude Code Launcher",
  "version": "1.0.0",
  "description": "Launch Claude Code sessions with page context",
  "permissions": [
    "contextMenus",
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "https://pure.md/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "options_page": "settings.html"
}
```

**Step 3: Create placeholder icons**

Generate three orange square PNG files (16x16, 48x48, 128x128) with a lightning bolt or "C" mark. Use any image editor or online tool. Save to `extension/icons/`.

**Step 4: Commit**

```bash
git add extension/ package.json package-lock.json tests/
git commit -m "chore: scaffold extension project structure"
```

---

## Task 2: Settings Storage Module

The settings module is pure JS (no DOM) — fully unit-testable.

**Files:**
- Create: `extension/settings-store.js`
- Create: `tests/unit/settings-store.test.js`

**Step 1: Write failing tests**

```javascript
// tests/unit/settings-store.test.js
const { parseSettings, defaultSettings, validateDistro } = require('../../extension/settings-store.js');

test('defaultSettings returns empty distros and blank systemPrompt', () => {
  const s = defaultSettings();
  expect(s.systemPrompt).toBe('');
  expect(s.distros).toEqual([]);
});

test('validateDistro rejects empty name', () => {
  expect(validateDistro({ name: '', paths: ['/home'] })).toBe(false);
});

test('validateDistro rejects distro with no paths', () => {
  expect(validateDistro({ name: 'my-distro', paths: [] })).toBe(false);
});

test('validateDistro accepts valid distro', () => {
  expect(validateDistro({ name: 'playground', paths: ['/home/dev/repos'] })).toBe(true);
});

test('parseSettings fills missing keys with defaults', () => {
  const result = parseSettings({ distros: [] });
  expect(result.systemPrompt).toBe('');
  expect(result.distros).toEqual([]);
});
```

**Step 2: Run to verify failure**

```bash
npx jest tests/unit/settings-store.test.js
```
Expected: FAIL — "Cannot find module"

**Step 3: Implement settings-store.js**

```javascript
// extension/settings-store.js
// Pure functions for settings shape — no chrome.storage calls here (those go in popup/settings JS)

function defaultSettings() {
  return { systemPrompt: '', distros: [] };
}

function parseSettings(raw) {
  const defaults = defaultSettings();
  return Object.assign({}, defaults, raw);
}

function validateDistro(distro) {
  return (
    typeof distro.name === 'string' &&
    distro.name.trim().length > 0 &&
    Array.isArray(distro.paths) &&
    distro.paths.length > 0
  );
}

module.exports = { defaultSettings, parseSettings, validateDistro };
```

**Step 4: Run tests**

```bash
npx jest tests/unit/settings-store.test.js
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add extension/settings-store.js tests/unit/settings-store.test.js
git commit -m "feat: settings storage module with validation"
```

---

## Task 3: Deeplink Assembly Module

This is the core logic — pure JS, fully unit-testable.

**Files:**
- Create: `extension/assemble-deeplink.js`
- Create: `tests/unit/assemble-deeplink.test.js`

**Step 1: Write failing tests**

```javascript
// tests/unit/assemble-deeplink.test.js
const { assembleRelayUrl, encodeContent, shouldFerryAsFile } = require('../../extension/assemble-deeplink.js');

const RELAY = 'https://timothyeastvold.github.io/cc/';

test('assembleRelayUrl with no distro/path builds minimal URL', () => {
  const url = assembleRelayUrl({ prompt: 'hello', distro: '', path: '', content: '' }, RELAY);
  expect(url).toBe(RELAY + '?q=hello');
});

test('assembleRelayUrl includes distro and path when set', () => {
  const url = assembleRelayUrl({ prompt: 'hello', distro: 'playground', path: '/home/dev', content: '' }, RELAY);
  expect(url).toContain('distro=playground');
  expect(url).toContain('path=%2Fhome%2Fdev');
});

test('assembleRelayUrl includes base64 content param when content provided', () => {
  const url = assembleRelayUrl({ prompt: 'hi', distro: '', path: '', content: 'some context' }, RELAY);
  expect(url).toContain('content=');
  const params = new URLSearchParams(url.split('?')[1]);
  expect(atob(params.get('content'))).toBe('some context');
});

test('shouldFerryAsFile returns true for full page context', () => {
  expect(shouldFerryAsFile('fullpage')).toBe(true);
});

test('shouldFerryAsFile returns false for selection only', () => {
  expect(shouldFerryAsFile('selection')).toBe(false);
});

test('encodeContent returns base64 string', () => {
  const result = encodeContent('hello world');
  expect(typeof result).toBe('string');
  expect(atob(result)).toBe('hello world');
});
```

**Step 2: Run to verify failure**

```bash
npx jest tests/unit/assemble-deeplink.test.js
```

**Step 3: Implement assemble-deeplink.js**

Note: This file runs in both Node (tests) and browser (extension). Use `btoa` for base64 — available in both.

```javascript
// extension/assemble-deeplink.js

function encodeContent(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

// contextSource: 'fullpage' | 'selection' | 'none'
function shouldFerryAsFile(contextSource) {
  return contextSource === 'fullpage';
}

function assembleRelayUrl(params, relayBase) {
  const { prompt, distro, path, content } = params;
  const qs = new URLSearchParams();
  qs.set('q', prompt);
  if (distro) qs.set('distro', distro);
  if (path) qs.set('path', path);
  if (content) qs.set('content', encodeContent(content));
  return relayBase + '?' + qs.toString();
}

// For Node test environment
if (typeof module !== 'undefined') {
  module.exports = { assembleRelayUrl, encodeContent, shouldFerryAsFile };
}
```

**Step 4: Run tests**

```bash
npx jest tests/unit/assemble-deeplink.test.js
```
Expected: PASS

**Step 5: Commit**

```bash
git add extension/assemble-deeplink.js tests/unit/assemble-deeplink.test.js
git commit -m "feat: deeplink assembly module with base64 content encoding"
```

---

## Task 4: Content Script (Selection Capture)

Runs injected into every page. Captures selected text and image URLs from the selection.

**Files:**
- Create: `extension/content.js`

No unit tests here — DOM manipulation is tested manually. The content script is minimal by design.

**Step 1: Implement content.js**

```javascript
// extension/content.js
// Listens for a message from the popup requesting selection data.
// Returns: { text: string, imageUrls: string[] }

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GET_SELECTION') return;

  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : '';

  const imageUrls = [];
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    fragment.querySelectorAll('img').forEach(img => {
      if (img.src) imageUrls.push(img.src);
    });
  }

  sendResponse({ text, imageUrls });
  return true; // keep channel open for async
});
```

**Step 2: Manual test**
Load the extension in Chrome (chrome://extensions → Load unpacked → select `extension/`). Open any page, select some text containing an image, open popup DevTools console and run:
```javascript
chrome.tabs.query({active:true,currentWindow:true}, tabs =>
  chrome.tabs.sendMessage(tabs[0].id, {type:'GET_SELECTION'}, r => console.log(r))
);
```
Expected: `{ text: "...", imageUrls: ["https://..."] }`

**Step 3: Commit**

```bash
git add extension/content.js
git commit -m "feat: content script for selection and image URL capture"
```

---

## Task 5: Background Service Worker

Registers the context menu item and coordinates between content script and popup.

**Files:**
- Create: `extension/background.js`

**Step 1: Implement background.js**

```javascript
// extension/background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'claude-launcher',
    title: 'Send to Claude Code',
    contexts: ['selection', 'page']
  });
});

// Context menu click → open popup with flag that it was triggered by right-click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Store trigger source so popup knows to auto-include selection
  chrome.storage.session.set({ trigger: 'contextmenu', tabId: tab.id });
  chrome.action.openPopup();
});
```

**Step 2: Manual test**
Reload extension. Right-click on a page — verify "Send to Claude Code" appears in context menu.

**Step 3: Commit**

```bash
git add extension/background.js
git commit -m "feat: background worker with context menu registration"
```

---

## Task 6: Popup UI — HTML & CSS

**Files:**
- Create: `extension/popup.html`
- Create: `extension/popup.css`

**Step 1: Implement popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <header>
      <span class="title">Claude Code</span>
      <a href="settings.html" target="_blank" id="settings-btn" title="Settings">⚙</a>
    </header>

    <section id="context-section">
      <div id="selection-row" class="context-row hidden">
        <details>
          <summary id="selection-summary">Selected text</summary>
          <pre id="selection-preview"></pre>
          <div id="image-urls-row" class="hidden">
            <span class="label">Images:</span>
            <ul id="image-urls-list"></ul>
          </div>
        </details>
      </div>

      <label id="fullpage-label" class="context-row">
        <input type="checkbox" id="include-fullpage">
        Include full page (pure.md)
      </label>

      <div id="fullpage-row" class="context-row hidden">
        <details>
          <summary id="fullpage-summary">Page markdown</summary>
          <pre id="fullpage-preview"></pre>
        </details>
      </div>

      <div id="fullpage-loading" class="hidden">Fetching page…</div>
      <div id="fullpage-error" class="hidden error"></div>
    </section>

    <section>
      <textarea id="prompt" placeholder="Type your prompt…" rows="4" autofocus></textarea>
    </section>

    <section id="target-section">
      <div class="field-row">
        <label>Distro</label>
        <select id="distro-select">
          <option value="">(none — Windows default)</option>
        </select>
      </div>
      <div class="field-row">
        <label>Path</label>
        <select id="path-select">
          <option value="">(default)</option>
        </select>
      </div>
    </section>

    <button id="launch-btn">Launch Claude Code →</button>
  </div>
  <script src="assemble-deeplink.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Implement popup.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  width: 360px;
  background: #fff;
  color: #222;
}

#app { padding: 12px; display: flex; flex-direction: column; gap: 10px; }

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title { font-weight: 700; font-size: 14px; color: #e8630a; }
#settings-btn { color: #999; text-decoration: none; font-size: 16px; }
#settings-btn:hover { color: #333; }

.context-row { display: flex; flex-direction: column; gap: 4px; }
.context-row details summary {
  cursor: pointer;
  font-size: 12px;
  color: #777;
  user-select: none;
}
.context-row details summary:hover { color: #333; }
.context-row details pre {
  margin-top: 6px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  font-size: 11px;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.hidden { display: none !important; }
.error { color: #c00; font-size: 12px; }

.field-row {
  display: grid;
  grid-template-columns: 48px 1fr;
  align-items: center;
  gap: 6px;
}
.field-row label { font-size: 12px; color: #777; }
.field-row select {
  font-size: 12px;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
}

textarea {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}
textarea:focus { outline: 2px solid #e8630a; border-color: transparent; }

#launch-btn {
  background: #e8630a;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
}
#launch-btn:hover { background: #cf5808; }
#launch-btn:disabled { background: #ccc; cursor: default; }
```

**Step 3: Manual visual test**
Reload extension, click toolbar icon. Verify layout matches design: header with gear, collapsed context area, prompt textarea, distro/path dropdowns, orange launch button.

**Step 4: Commit**

```bash
git add extension/popup.html extension/popup.css
git commit -m "feat: popup HTML and CSS layout"
```

---

## Task 7: Popup JS — Core Logic

**Files:**
- Create: `extension/popup.js`

**Step 1: Implement popup.js**

```javascript
// extension/popup.js
const RELAY_URL = 'https://timothyeastvold.github.io/cc/';
const PURE_MD_BASE = 'https://pure.md/';

let settings = { systemPrompt: '', distros: [] };
let selectionData = { text: '', imageUrls: [] };
let fullPageMarkdown = '';

async function init() {
  // Load settings
  const stored = await chrome.storage.sync.get(['systemPrompt', 'distros']);
  settings = { systemPrompt: stored.systemPrompt || '', distros: stored.distros || [] };

  // Populate distro dropdown
  populateDistros();

  // Check if triggered from context menu (has selection)
  const session = await chrome.storage.session.get(['trigger', 'tabId']);
  if (session.trigger === 'contextmenu') {
    chrome.storage.session.remove(['trigger', 'tabId']);
    await captureSelection();
  }

  // Wire up fullpage checkbox
  document.getElementById('include-fullpage').addEventListener('change', onFullPageToggle);

  // Wire up distro dropdown
  document.getElementById('distro-select').addEventListener('change', onDistroChange);

  // Launch button
  document.getElementById('launch-btn').addEventListener('click', onLaunch);

  // Auto-focus prompt
  document.getElementById('prompt').focus();
}

function populateDistros() {
  const sel = document.getElementById('distro-select');
  sel.innerHTML = '<option value="">(none — Windows default)</option>';
  settings.distros.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

function onDistroChange() {
  const distroName = document.getElementById('distro-select').value;
  const pathSel = document.getElementById('path-select');
  pathSel.innerHTML = '<option value="">(default)</option>';
  if (!distroName) return;
  const distro = settings.distros.find(d => d.name === distroName);
  if (!distro) return;
  distro.paths.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    pathSel.appendChild(opt);
  });
}

async function captureSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
    selectionData = result || { text: '', imageUrls: [] };
  } catch {
    selectionData = { text: '', imageUrls: [] };
  }

  if (selectionData.text) {
    document.getElementById('selection-row').classList.remove('hidden');
    document.getElementById('selection-summary').textContent =
      `Selected text (${selectionData.text.length} chars)`;
    document.getElementById('selection-preview').textContent = selectionData.text;
  }

  if (selectionData.imageUrls.length > 0) {
    document.getElementById('image-urls-row').classList.remove('hidden');
    const ul = document.getElementById('image-urls-list');
    selectionData.imageUrls.forEach(url => {
      const li = document.createElement('li');
      li.textContent = url;
      ul.appendChild(li);
    });
  }
}

async function onFullPageToggle(e) {
  const checked = e.target.checked;
  document.getElementById('fullpage-row').classList.toggle('hidden', !checked);
  document.getElementById('fullpage-error').classList.add('hidden');

  if (!checked) { fullPageMarkdown = ''; return; }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('fullpage-loading').classList.remove('hidden');
  document.getElementById('launch-btn').disabled = true;

  try {
    const res = await fetch(PURE_MD_BASE + tab.url);
    if (!res.ok) throw new Error(`pure.md returned ${res.status}`);
    fullPageMarkdown = await res.text();

    document.getElementById('fullpage-summary').textContent =
      `Page markdown (~${Math.round(fullPageMarkdown.length / 1000)}k chars — ferried as file)`;
    document.getElementById('fullpage-preview').textContent =
      fullPageMarkdown.slice(0, 500) + (fullPageMarkdown.length > 500 ? '\n…' : '');
    document.getElementById('fullpage-row').classList.remove('hidden');
  } catch (err) {
    document.getElementById('fullpage-error').textContent = 'Could not fetch page: ' + err.message;
    document.getElementById('fullpage-error').classList.remove('hidden');
    document.getElementById('include-fullpage').checked = false;
    fullPageMarkdown = '';
  } finally {
    document.getElementById('fullpage-loading').classList.add('hidden');
    document.getElementById('launch-btn').disabled = false;
  }
}

function buildFinalPrompt(userPrompt) {
  const parts = [];
  if (settings.systemPrompt) parts.push(settings.systemPrompt);
  if (selectionData.text) {
    parts.push('## Selected text\n\n' + selectionData.text);
  }
  if (selectionData.imageUrls.length > 0) {
    parts.push('## Referenced images\n\n' + selectionData.imageUrls.map(u => '- ' + u).join('\n'));
  }
  if (fullPageMarkdown) {
    parts.push('## Context file\n\nContext has been written to `/tmp/cc-context.md`');
  }
  if (userPrompt) parts.push(userPrompt);
  return parts.join('\n\n---\n\n');
}

async function onLaunch() {
  const userPrompt = document.getElementById('prompt').value.trim();
  if (!userPrompt && !selectionData.text && !fullPageMarkdown) {
    document.getElementById('prompt').focus();
    return;
  }

  const distro = document.getElementById('distro-select').value;
  const path = document.getElementById('path-select').value;
  const finalPrompt = buildFinalPrompt(userPrompt);

  // Full page markdown → always ferry as file via content= param
  const content = fullPageMarkdown || '';

  const url = assembleRelayUrl({ prompt: finalPrompt, distro, path, content }, RELAY_URL);

  await chrome.tabs.create({ url });
  window.close();
}

document.addEventListener('DOMContentLoaded', init);
```

**Step 2: Manual end-to-end test**
1. Load extension, click icon, type a prompt, hit Launch
2. Verify relay page opens with correct `q=` param
3. Verify relay page fires `claude-cli://` and WezTerm opens

**Step 3: Commit**

```bash
git add extension/popup.js
git commit -m "feat: popup JS with selection capture, pure.md fetch, and deeplink launch"
```

---

## Task 8: Settings Page

**Files:**
- Create: `extension/settings.html`
- Create: `extension/settings.js`
- Create: `extension/settings.css`

**Step 1: Implement settings.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Claude Code Launcher — Settings</title>
  <link rel="stylesheet" href="settings.css">
</head>
<body>
  <div id="app">
    <h1>Claude Code Launcher</h1>

    <section>
      <h2>System Prompt <span class="hint">(added silently to every launch)</span></h2>
      <textarea id="system-prompt" rows="4" placeholder="Optional system-level instructions…"></textarea>
    </section>

    <section>
      <h2>Distros &amp; Paths</h2>
      <div id="distros-list"></div>
      <button id="add-distro-btn" class="secondary">+ Add distro</button>
    </section>

    <div id="save-row">
      <button id="save-btn">Save settings</button>
      <span id="save-status"></span>
    </div>
  </div>
  <script src="settings-store.js"></script>
  <script src="settings.js"></script>
</body>
</html>
```

**Step 2: Implement settings.js**

```javascript
// extension/settings.js
let distros = [];

async function init() {
  const stored = await chrome.storage.sync.get(['systemPrompt', 'distros']);
  document.getElementById('system-prompt').value = stored.systemPrompt || '';
  distros = stored.distros || [];
  renderDistros();
  document.getElementById('add-distro-btn').addEventListener('click', addDistro);
  document.getElementById('save-btn').addEventListener('click', save);
}

function renderDistros() {
  const container = document.getElementById('distros-list');
  container.innerHTML = '';
  distros.forEach((distro, di) => {
    const block = document.createElement('div');
    block.className = 'distro-block';
    block.innerHTML = `
      <div class="distro-header">
        <input class="distro-name" value="${escHtml(distro.name)}" placeholder="distro-name" data-di="${di}">
        <button class="remove-distro" data-di="${di}">✕</button>
      </div>
      <div class="paths-list" data-di="${di}">
        ${distro.paths.map((p, pi) => pathRow(di, pi, p)).join('')}
      </div>
      <button class="add-path" data-di="${di}">+ Add path</button>
    `;
    container.appendChild(block);
  });

  // Wire events
  container.querySelectorAll('.distro-name').forEach(el => {
    el.addEventListener('input', e => {
      distros[+e.target.dataset.di].name = e.target.value;
    });
  });
  container.querySelectorAll('.remove-distro').forEach(el => {
    el.addEventListener('click', e => {
      distros.splice(+e.target.dataset.di, 1);
      renderDistros();
    });
  });
  container.querySelectorAll('.path-input').forEach(el => {
    el.addEventListener('input', e => {
      distros[+e.target.dataset.di].paths[+e.target.dataset.pi] = e.target.value;
    });
  });
  container.querySelectorAll('.remove-path').forEach(el => {
    el.addEventListener('click', e => {
      const di = +e.target.dataset.di, pi = +e.target.dataset.pi;
      distros[di].paths.splice(pi, 1);
      renderDistros();
    });
  });
  container.querySelectorAll('.add-path').forEach(el => {
    el.addEventListener('click', e => {
      distros[+e.target.dataset.di].paths.push('');
      renderDistros();
    });
  });
}

function pathRow(di, pi, path) {
  return `<div class="path-row">
    <input class="path-input" value="${escHtml(path)}" placeholder="/home/dev/repos/..." data-di="${di}" data-pi="${pi}">
    <button class="remove-path" data-di="${di}" data-pi="${pi}">✕</button>
  </div>`;
}

function addDistro() {
  distros.push({ name: '', paths: [''] });
  renderDistros();
}

async function save() {
  const systemPrompt = document.getElementById('system-prompt').value;
  const validDistros = distros.filter(d => validateDistro(d));
  await chrome.storage.sync.set({ systemPrompt, distros: validDistros });
  const status = document.getElementById('save-status');
  status.textContent = 'Saved.';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', init);
```

**Step 3: Implement settings.css** — extend popup.css styles. Key additions:

```css
/* extension/settings.css */
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #222; }
#app { max-width: 560px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 20px; }
h1 { font-size: 16px; color: #e8630a; }
h2 { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.hint { font-weight: 400; color: #999; }
textarea { width: 100%; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-size: 13px; font-family: inherit; resize: vertical; }
.distro-block { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; }
.distro-header { display: flex; gap: 8px; }
.distro-name { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 5px 8px; font-size: 13px; }
.path-row { display: flex; gap: 8px; }
.path-input { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 5px 8px; font-size: 12px; font-family: monospace; }
button { font-size: 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ddd; padding: 5px 10px; background: #fff; }
button:hover { background: #f5f5f5; }
#save-btn { background: #e8630a; color: #fff; border-color: #e8630a; font-weight: 700; padding: 8px 20px; }
#save-btn:hover { background: #cf5808; }
#save-row { display: flex; align-items: center; gap: 12px; }
#save-status { font-size: 12px; color: #4a4; }
.remove-distro, .remove-path { color: #999; flex-shrink: 0; }
.add-path, #add-distro-btn { font-size: 12px; color: #e8630a; background: none; border: 1px dashed #e8630a; padding: 4px 10px; }
```

**Step 4: Manual test**
Open settings (gear icon from popup). Add a distro, add paths to it, save. Reopen popup — verify distro appears in dropdown and paths populate on selection.

**Step 5: Commit**

```bash
git add extension/settings.html extension/settings.js extension/settings.css
git commit -m "feat: settings page for system prompt and distro/path management"
```

---

## Task 9: Update PowerShell Script (content= param support)

The PS script needs to handle a new `content=` parameter: base64-encoded context that gets written to `/tmp/cc-context.md` in the target WSL distro before launching Claude.

**Files:**
- Modify: `C:\Users\TimothyEastvold\scripts\claude-deeplink.ps1`
- Create: `scripts/claude-deeplink.ps1` (tracked copy in this repo)

**Step 1: Copy current PS script into repo**

```bash
cp /mnt/c/Users/TimothyEastvold/scripts/claude-deeplink.ps1 scripts/claude-deeplink.ps1
```

**Step 2: Add content= handling**

After the existing param parsing block (after line ~44), add:

```powershell
$contentBase64 = ""
if ($params.ContainsKey('content') -and $params['content']) {
    $contentBase64 = $params['content']
}
```

In the WSL mode block, before `$claudeCmd` is defined, add:

```powershell
# If content was passed, write it to /tmp/cc-context.md in the distro
if ($contentBase64) {
    $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($contentBase64))
    $escapedContent = $decoded -replace "'", "'\''"
    $writeCmd = "printf '%s' '$escapedContent' > /tmp/cc-context.md"
    wsl.exe -d $distro -- bash -lc $writeCmd
    "$(Get-Date) - Wrote context file to /tmp/cc-context.md in $distro" | Out-File $logFile -Append
}
```

**Step 3: Manual test**
Encode a test string: `[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("hello world"))` in PowerShell. Construct a `claude-cli://open?q=test&distro=playground&path=/home/dev&content=aGVsbG8gd29ybGQ=` URL. Verify `/tmp/cc-context.md` exists in the distro after launch.

**Step 4: Deploy**

```bash
cp scripts/claude-deeplink.ps1 /mnt/c/Users/TimothyEastvold/scripts/claude-deeplink.ps1
```

**Step 5: Commit**

```bash
git add scripts/claude-deeplink.ps1
git commit -m "feat: PS script handles content= param, writes to /tmp/cc-context.md in WSL distro"
```

---

## Task 10: Update Relay Page (content= passthrough)

The GitHub relay page needs to pass `content=` through to the `claude-cli://` URL.

**Files:**
- Create: `relay/index.html` (working copy of the relay page to be pushed to GitHub)

**Step 1: Copy current relay page**

```bash
curl -s https://timothyeastvold.github.io/cc/ > relay/index.html
```

**Step 2: Update the JS param handling**

Find this block in `relay/index.html`:
```javascript
var clUrl = 'claude-cli://open?q=' + encodeURIComponent(q);
if (distro) clUrl += '&distro=' + encodeURIComponent(distro);
if (path) clUrl += '&path=' + encodeURIComponent(path);
```

Add below it:
```javascript
var content = params.get('content') || '';
if (content) clUrl += '&content=' + encodeURIComponent(content);
```

Also update the param extraction near the top to read `content`:
```javascript
var content = params.get('content') || '';
```

**Step 3: Verify relay still works without content param**
Open `relay/index.html` locally (via a simple HTTP server) with `?q=hello` — verify it still fires `claude-cli://open?q=hello`.

**Step 4: Push to GitHub**

The relay page lives in the `TimothyEastvold/cc` repo. Push the updated `relay/index.html` as `index.html` to that repo's main branch.

**Step 5: Commit relay copy**

```bash
git add relay/index.html
git commit -m "feat: relay page passes content= param through to claude-cli://"
```

---

## Task 11: End-to-End Integration Test

**Scenarios to verify manually:**

1. **No context, no distro** — type a prompt, launch → relay page opens → WezTerm opens in Notes dir with prompt
2. **Selection only** — select text on a page, right-click "Send to Claude Code", type prompt, launch → selection appears inline in Claude prompt
3. **Selection with images** — select text containing an `<img>`, launch → image URLs listed in prompt
4. **Full page via pure.md** — check "Include full page", verify collapsed preview shows char count, launch → `/tmp/cc-context.md` written in distro, Claude references it
5. **Distro + path** — set playground distro + specific path in popup, launch → WezTerm opens in correct WSL path
6. **System prompt** — set a system prompt in settings, launch → system prompt prepended silently (verify in WezTerm that Claude received it)

**Step 1: Run through each scenario**

Document any failures with the relay URL that was generated (visible in browser address bar before protocol fires).

**Step 2: Commit any fixes found**

---

## Final Notes

- **Icons:** Generate proper icons before any public release. A simple Claude-orange "C" on dark background works.
- **Chrome Web Store:** Not required for personal use — load unpacked via `chrome://extensions` is sufficient.
- **pure.md rate limits:** No documented rate limit, but the fetch is user-initiated so load is minimal.
- **Security:** The `content=` param in the relay URL is base64 (not encrypted). Don't pass secrets through it.
