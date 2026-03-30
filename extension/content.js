// extension/content.js
// Injected into every page. Listens for GET_SELECTION message,
// returns selected text and image URLs from within the selection.

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
  return true; // keep message channel open for async
});
