// Pure functions for settings shape — no chrome.storage calls here

function defaultSettings() {
  return { systemPrompt: '', distros: [], urlRules: [] };
}

function parseSettings(raw) {
  const defaults = defaultSettings();
  return Object.assign({}, defaults, raw);
}

function validateDistro(distro) {
  if (typeof distro.name !== 'string' || distro.name.trim().length === 0) return false;
  if (!Array.isArray(distro.paths) || distro.paths.length === 0) return false;
  if (!distro.paths.every(p => typeof p === 'string' && p.trim().length > 0)) return false;
  if ('worktreeDefault' in distro && typeof distro.worktreeDefault !== 'boolean') return false;
  return true;
}

// Node/Jest compatibility — not available in browser but harmless check
if (typeof module !== 'undefined') {
  module.exports = { defaultSettings, parseSettings, validateDistro };
}
