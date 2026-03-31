// extension/background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'claude-launcher',
    title: 'Send to Claude Code',
    contexts: ['selection', 'page']
  });
});

// Context menu click: store trigger source so popup auto-captures selection
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.session.set({ trigger: 'contextmenu', tabId: tab.id });
  chrome.action.openPopup();
});
