// extension/content-github.js
// DOM injection runs only in browser; pure functions are exported for tests.

// --- Pure functions ---

function slugifyTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// data: { type, number, title, url, description, comments: [{author, date, body}] }
// mode: 'description' | 'thread'
function formatGitHubContent(data, mode) {
  const { type, number, title, url, description, comments } = data;
  let out = `# ${type} #${number}: ${title}\n\n**URL:** ${url}\n\n## Description\n\n${description}`;
  if (mode === 'thread') {
    for (const c of comments) {
      const datePart = c.date ? ` (${c.date})` : '';
      out += `\n\n## Comment by @${c.author}${datePart}\n\n${c.body}`;
    }
  }
  return out;
}

function extractPageData() {
  const url = window.location.href;
  const match = url.match(/\/(pull|issues)\/(\d+)/);
  if (!match) return null;

  const type = match[1] === 'pull' ? 'PR' : 'Issue';
  const number = match[2];

  const titleEl =
    document.querySelector('[data-testid="issue-title"]') ||
    document.querySelector('.js-issue-title');
  const title = titleEl ? titleEl.textContent.trim() : document.title;

  const bodyEl =
    document.querySelector('[data-testid="issue-body"] .js-comment-body') ||
    document.querySelector('[data-testid="issue-body"]') ||
    document.querySelector('.js-comment-body');
  const description = bodyEl ? bodyEl.innerText.trim() : '';

  const comments = [];
  const commentEls = document.querySelectorAll('.timeline-comment');
  commentEls.forEach((el, i) => {
    if (i === 0) return; // skip OP — already captured as description
    const author =
      el.querySelector('.author')?.textContent.trim() ||
      el.querySelector('[data-hovercard-type="user"]')?.textContent.trim() ||
      'unknown';
    const body =
      el.querySelector('.js-comment-body')?.innerText.trim() || '';
    const dateEl = el.querySelector('relative-time');
    const date = dateEl ? (dateEl.getAttribute('datetime') || '').slice(0, 10) : '';
    if (body) comments.push({ author, date, body });
  });

  return { type, number, title, url, description, comments };
}

if (typeof module !== 'undefined') {
  module.exports = { slugifyTitle, formatGitHubContent };
}
