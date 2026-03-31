// Pure functions for settings shape — no chrome.storage calls here

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
    distro.paths.length > 0 &&
    distro.paths.every(p => typeof p === 'string' && p.trim().length > 0)
  );
}

// Node/Jest compatibility — not available in browser but harmless check
if (typeof module !== 'undefined') {
  module.exports = { defaultSettings, parseSettings, validateDistro };
}
