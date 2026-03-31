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

if (typeof module !== 'undefined') {
  module.exports = { slugifyTitle, formatGitHubContent };
}
