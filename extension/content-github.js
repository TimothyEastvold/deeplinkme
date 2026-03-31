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
  const title = titleEl ? titleEl.innerText.trim() : document.title;

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

// --- Browser-only: button injection ---
if (typeof window !== 'undefined' && typeof chrome !== 'undefined') {

  const STYLE_ID = 'dlm-github-styles';
  const BTN_CLASS = 'dlm-btn-wrap';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dlm-btn-wrap { position: relative; display: inline-flex; margin-left: 8px; }
      .dlm-btn {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; font-size: 12px; font-weight: 500;
        border: 1px solid rgba(27,31,36,0.15); border-radius: 6px;
        background: #f6f8fa; color: #24292f; cursor: pointer;
        white-space: nowrap;
      }
      .dlm-btn:hover { background: #e9ebec; border-color: rgba(27,31,36,0.3); }
      .dlm-menu {
        display: none; position: absolute; top: 100%; right: 0;
        margin-top: 4px; z-index: 9999;
        background: #fff; border: 1px solid #d0d7de; border-radius: 6px;
        box-shadow: 0 8px 24px rgba(140,149,159,0.2);
        min-width: 160px; overflow: hidden;
      }
      .dlm-btn-wrap:hover .dlm-menu { display: block; }
      .dlm-opt {
        display: block; width: 100%; padding: 8px 12px;
        text-align: left; font-size: 13px; color: #24292f;
        background: none; border: none; cursor: pointer;
      }
      .dlm-opt:hover { background: #f6f8fa; }
    `;
    document.head.appendChild(style);
  }

  function isGitHubIssuePR() {
    return /\/(pull|issues)\/\d+/.test(window.location.pathname);
  }

  function removeExistingButton() {
    document.querySelectorAll('.' + BTN_CLASS).forEach(el => el.remove());
  }

  function injectButton() {
    if (!isGitHubIssuePR()) return;
    removeExistingButton();
    injectStyles();

    const actionsContainer =
      document.querySelector('.gh-header-actions') ||
      document.querySelector('.js-sticky-header .gh-header-actions');
    if (!actionsContainer) return;

    const wrap = document.createElement('div');
    wrap.className = BTN_CLASS;
    wrap.innerHTML = `
      <button class="dlm-btn" type="button" title="Send to Claude Code">⚡ Claude</button>
      <div class="dlm-menu">
        <button class="dlm-opt" data-mode="description">Title + description</button>
        <button class="dlm-opt" data-mode="thread">Full thread</button>
      </div>
    `;

    wrap.querySelectorAll('.dlm-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        const data = extractPageData();
        if (!data) return;
        const content = formatGitHubContent(data, mode);
        const slug = slugifyTitle(`${data.title}-${data.number}`);
        chrome.runtime.sendMessage({
          type: 'GITHUB_CONTEXT',
          content,
          slug,
          pageType: data.type
        });
      });
    });

    actionsContainer.appendChild(wrap);
  }

  // Initial injection
  injectButton();

  // Re-inject after Turbo SPA navigation
  document.addEventListener('turbo:load', injectButton);

  // Fallback MutationObserver: re-inject if button is gone after DOM changes
  const observer = new MutationObserver(() => {
    if (isGitHubIssuePR() && !document.querySelector('.' + BTN_CLASS)) {
      injectButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
