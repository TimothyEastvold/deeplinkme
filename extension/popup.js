// extension/popup.js
const RELAY_URL = 'https://timothyeastvold.github.io/cc/';
const PURE_MD_BASE = 'https://pure.md/';

let settings = { systemPrompt: '', distros: [], urlRules: [] };
let selectionData = { text: '', imageUrls: [] };
let fullPageMarkdown = '';
let githubContent = '';
let fullPageFetchController = null;

async function init() {
  const stored = await chrome.storage.sync.get(['systemPrompt', 'distros', 'urlRules']);
  settings = {
    systemPrompt: stored.systemPrompt || '',
    distros: stored.distros || [],
    urlRules: stored.urlRules || []
  };

  populateDistros();

  // Auto-select distro based on current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  applyUrlRule(tab && tab.url);

  // Always capture selection — works whether opened via toolbar click or context menu
  const session = await chrome.storage.session.get('trigger');
  if (session.trigger === 'contextmenu') {
    await chrome.storage.session.remove('trigger');
  }
  await captureSelection();
  await loadGithubContext();

  document.getElementById('include-fullpage').addEventListener('change', onFullPageToggle);
  document.getElementById('distro-select').addEventListener('change', onDistroChange);
  document.getElementById('use-worktree').addEventListener('change', onWorktreeToggle);
  document.getElementById('launch-btn').addEventListener('click', onLaunch);
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
  if (!distroName) {
    pathSel.innerHTML = '<option value="">(default)</option>';
    return;
  }
  const distro = settings.distros.find(d => d.name === distroName);
  if (!distro) return;
  pathSel.innerHTML = '';
  distro.paths.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    pathSel.appendChild(opt);
  });
}

function applyUrlRule(tabUrl) {
  if (!tabUrl || !settings.urlRules.length) return;
  const lower = tabUrl.toLowerCase();
  const rule = settings.urlRules.find(r => r.pattern && lower.includes(r.pattern.toLowerCase()));
  if (!rule) return;
  const sel = document.getElementById('distro-select');
  sel.value = rule.distro;
  onDistroChange();
}

async function captureSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
    selectionData = result || { text: '', imageUrls: [] };
  } catch {
    // Content script not yet injected in this tab (e.g. tab was open before extension install).
    // Inject it programmatically, then retry.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const result = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
      selectionData = result || { text: '', imageUrls: [] };
    } catch {
      selectionData = { text: '', imageUrls: [] };
    }
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
    ul.innerHTML = '';
    selectionData.imageUrls.forEach(url => {
      const li = document.createElement('li');
      li.textContent = url;
      ul.appendChild(li);
    });
  }
}

async function loadGithubContext() {
  const session = await chrome.storage.session.get('githubContext');
  if (!session.githubContext) return;

  const { content, slug, pageType } = session.githubContext;
  await chrome.storage.session.remove('githubContext');

  githubContent = content;

  const label = pageType === 'PR' ? 'GitHub PR' : 'GitHub Issue';
  document.getElementById('github-context-row').classList.remove('hidden');
  document.getElementById('github-context-summary').textContent =
    `${label} (~${Math.round(content.length / 1000)}k chars — ferried as file)`;
  document.getElementById('github-context-preview').textContent =
    content.slice(0, 500) + (content.length > 500 ? '\n…' : '');

  // Apply worktreeDefault for the auto-selected distro
  const distroName = document.getElementById('distro-select').value;
  const distro = settings.distros.find(d => d.name === distroName);
  if (distro && distro.worktreeDefault) {
    document.getElementById('use-worktree').checked = true;
    document.getElementById('worktree-row').classList.remove('hidden');
  }

  // Pre-fill worktree name with slugified title
  if (slug) {
    document.getElementById('worktree-name').value = slug;
  }
}

async function onFullPageToggle(e) {
  const checked = e.target.checked;
  document.getElementById('fullpage-row').classList.toggle('hidden', !checked);
  document.getElementById('fullpage-error').classList.add('hidden');

  if (!checked) {
    fullPageMarkdown = '';
    if (fullPageFetchController) {
      fullPageFetchController.abort();
      fullPageFetchController = null;
    }
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  document.getElementById('fullpage-loading').classList.remove('hidden');
  document.getElementById('launch-btn').disabled = true;

  fullPageFetchController = new AbortController();

  try {
    const res = await fetch(PURE_MD_BASE + encodeURIComponent(tab.url), { signal: fullPageFetchController.signal });
    if (!res.ok) throw new Error(`pure.md returned ${res.status}`);
    fullPageMarkdown = await res.text();

    const MAX_CONTENT_BYTES = 500_000; // ~500KB unencoded; base64 adds ~33%
    if (fullPageMarkdown.length > MAX_CONTENT_BYTES) {
      document.getElementById('fullpage-error').textContent =
        `Page is too large to ferry (~${Math.round(fullPageMarkdown.length / 1000)}k chars). Try selecting a portion instead.`;
      document.getElementById('fullpage-error').classList.remove('hidden');
      document.getElementById('include-fullpage').checked = false;
      fullPageMarkdown = '';
      return; // skip the preview update below
    }

    document.getElementById('fullpage-summary').textContent =
      `Page markdown (~${Math.round(fullPageMarkdown.length / 1000)}k chars — ferried as file)`;
    document.getElementById('fullpage-preview').textContent =
      fullPageMarkdown.slice(0, 500) + (fullPageMarkdown.length > 500 ? '\n…' : '');
  } catch (err) {
    if (err.name === 'AbortError') {
      // User unchecked while fetch was in progress — silent
    } else {
      document.getElementById('fullpage-error').textContent = 'Could not fetch page: ' + err.message;
      document.getElementById('fullpage-error').classList.remove('hidden');
      document.getElementById('include-fullpage').checked = false;
    }
    fullPageMarkdown = '';
    fullPageFetchController = null;
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
  if (githubContent) {
    parts.push('## Context file\n\nContext has been written to `/tmp/cc-context.md`');
  }
  if (userPrompt) parts.push(userPrompt);
  return parts.join('\n\n---\n\n');
}

function onWorktreeToggle(e) {
  document.getElementById('worktree-row').classList.toggle('hidden', !e.target.checked);
  if (e.target.checked) {
    document.getElementById('worktree-name').focus();
  }
}

async function onLaunch() {
  const userPrompt = document.getElementById('prompt').value.trim();
  if (!userPrompt && !selectionData.text && !fullPageMarkdown) {
    document.getElementById('prompt').focus();
    return;
  }

  const distro = document.getElementById('distro-select').value;
  const path = document.getElementById('path-select').value;
  const worktree = document.getElementById('use-worktree').checked
    ? document.getElementById('worktree-name').value.trim()
    : '';
  const finalPrompt = buildFinalPrompt(userPrompt);
  const content = fullPageMarkdown || githubContent;

  const url = assembleRelayUrl({ prompt: finalPrompt, distro, path, content, worktree }, RELAY_URL);
  await chrome.tabs.create({ url });
  window.close();
}

document.addEventListener('DOMContentLoaded', init);
