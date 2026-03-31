function encodeContent(text) {
  // Handle unicode: convert to UTF-8 bytes represented as latin1, then base64
  return btoa(unescape(encodeURIComponent(text)));
}

// contextSource: 'fullpage' | 'selection' | 'none'
function shouldFerryAsFile(contextSource) {
  return contextSource === 'fullpage';
}

function assembleRelayUrl(params, relayBase) {
  const { prompt, distro, path, content, worktree } = params;
  const qs = new URLSearchParams();
  qs.set('q', prompt);
  if (distro) qs.set('distro', distro);
  if (path) qs.set('path', path);
  if (content) qs.set('content', encodeContent(content));
  if (worktree) qs.set('worktree', worktree);
  return relayBase + '?' + qs.toString();
}

if (typeof module !== 'undefined') {
  module.exports = { assembleRelayUrl, encodeContent, shouldFerryAsFile };
}
