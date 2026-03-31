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

test('validateDistro accepts distro with worktreeDefault true', () => {
  expect(validateDistro({ name: 'dev', paths: ['/home'], worktreeDefault: true })).toBe(true);
});

test('validateDistro accepts distro without worktreeDefault (backwards compat)', () => {
  expect(validateDistro({ name: 'dev', paths: ['/home'] })).toBe(true);
});

test('validateDistro rejects distro with non-boolean worktreeDefault', () => {
  expect(validateDistro({ name: 'dev', paths: ['/home'], worktreeDefault: 'yes' })).toBe(false);
});
