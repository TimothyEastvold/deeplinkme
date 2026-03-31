// extension/background.js

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.create({
    id: 'claude-launcher',
    title: 'Send to Claude Code',
    contexts: ['selection', 'page']
  });

  // On fresh install only, pre-populate settings from defaults.json
  // if the user hasn't configured anything yet.
  if (details.reason === 'install') {
    const existing = await chrome.storage.sync.get('distros');
    if (!existing.distros || existing.distros.length === 0) {
      const url = chrome.runtime.getURL('defaults.json');
      const res = await fetch(url);
      const defaults = await res.json();
      await chrome.storage.sync.set(defaults);
    }
  }
});

// Context menu click: store trigger source so popup auto-captures selection
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;
  chrome.storage.session.set({ trigger: 'contextmenu' });
  chrome.action.openPopup();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GITHUB_CONTEXT') return;
  chrome.storage.session.set({
    githubContext: {
      content: msg.content,
      slug: msg.slug,
      pageType: msg.pageType
    }
  }).then(() => {
    chrome.action.openPopup();
    sendResponse({ ok: true });
  });
  return true; // keep message channel open for async response
});
