const { slugifyTitle, formatGitHubContent } = require('../../extension/content-github.js');

// slugifyTitle
test('slugifyTitle lowercases and replaces spaces with hyphens', () => {
  expect(slugifyTitle('Fix Auth Bug')).toBe('fix-auth-bug');
});

test('slugifyTitle strips special characters', () => {
  expect(slugifyTitle('[WIP] Refactor: user model #42')).toBe('wip-refactor-user-model-42');
});

test('slugifyTitle trims leading and trailing hyphens', () => {
  expect(slugifyTitle('  -- Fix something --  ')).toBe('fix-something');
});

test('slugifyTitle truncates to 50 chars', () => {
  const long = 'a'.repeat(60);
  expect(slugifyTitle(long).length).toBe(50);
});

// formatGitHubContent
test('formatGitHubContent description mode includes title and url and body', () => {
  const result = formatGitHubContent({
    type: 'PR',
    number: '42',
    title: 'Fix bug',
    url: 'https://github.com/org/repo/pull/42',
    description: 'This fixes it.',
    comments: []
  }, 'description');
  expect(result).toContain('# PR #42: Fix bug');
  expect(result).toContain('https://github.com/org/repo/pull/42');
  expect(result).toContain('This fixes it.');
  expect(result).not.toContain('## Comment');
});

test('formatGitHubContent thread mode includes comments', () => {
  const result = formatGitHubContent({
    type: 'Issue',
    number: '7',
    title: 'Bug report',
    url: 'https://github.com/org/repo/issues/7',
    description: 'Describe the bug.',
    comments: [{ author: 'alice', date: '2026-03-31', body: 'Can confirm.' }]
  }, 'thread');
  expect(result).toContain('## Comment by @alice');
  expect(result).toContain('Can confirm.');
});

test('formatGitHubContent description mode ignores comments even if present', () => {
  const result = formatGitHubContent({
    type: 'PR', number: '1', title: 'x', url: 'u', description: 'd',
    comments: [{ author: 'bob', date: '', body: 'hello' }]
  }, 'description');
  expect(result).not.toContain('bob');
});
