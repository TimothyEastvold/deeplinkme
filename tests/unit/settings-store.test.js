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

test('validateDistro rejects distro with blank path entries', () => {
  expect(validateDistro({ name: 'my-distro', paths: [''] })).toBe(false);
});

test('parseSettings fills missing keys with defaults', () => {
  const result = parseSettings({ distros: [] });
  expect(result.systemPrompt).toBe('');
  expect(result.distros).toEqual([]);
});
