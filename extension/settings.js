// extension/settings.js
let distros = [];
let urlRules = [];

async function init() {
  const stored = await chrome.storage.sync.get(['systemPrompt', 'distros', 'urlRules']);
  document.getElementById('system-prompt').value = stored.systemPrompt || '';
  distros = stored.distros || [];
  urlRules = stored.urlRules || [];
  renderDistros();
  renderRules();
  document.getElementById('add-distro-btn').addEventListener('click', addDistro);
  document.getElementById('add-rule-btn').addEventListener('click', addRule);
  document.getElementById('save-btn').addEventListener('click', save);
}

function renderDistros() {
  const container = document.getElementById('distros-list');
  container.innerHTML = '';
  distros.forEach((distro, di) => {
    const block = document.createElement('div');
    block.className = 'distro-block';
    block.innerHTML = `
      <div class="distro-header">
        <input class="distro-name" value="${escHtml(distro.name)}" placeholder="distro-name" data-di="${di}">
        <button class="remove-distro" data-di="${di}" aria-label="Remove distro">✕</button>
      </div>
      <div class="paths-list">
        ${distro.paths.map((p, pi) => pathRow(di, pi, p)).join('')}
      </div>
      <button class="add-path" data-di="${di}">+ Add path</button>
      <label class="worktree-default-row">
        <input type="checkbox" class="worktree-default" data-di="${di}"${distro.worktreeDefault ? ' checked' : ''}>
        Worktree on by default
      </label>
    `;
    container.appendChild(block);
  });

  container.querySelectorAll('.distro-name').forEach(el => {
    el.addEventListener('input', e => {
      distros[+e.target.dataset.di].name = e.target.value;
    });
  });
  container.querySelectorAll('.remove-distro').forEach(el => {
    el.addEventListener('click', e => {
      distros.splice(+e.target.dataset.di, 1);
      renderDistros();
    });
  });
  container.querySelectorAll('.path-input').forEach(el => {
    el.addEventListener('input', e => {
      distros[+e.target.dataset.di].paths[+e.target.dataset.pi] = e.target.value;
    });
  });
  container.querySelectorAll('.remove-path').forEach(el => {
    el.addEventListener('click', e => {
      const di = +e.target.dataset.di, pi = +e.target.dataset.pi;
      distros[di].paths.splice(pi, 1);
      renderDistros();
    });
  });
  container.querySelectorAll('.add-path').forEach(el => {
    el.addEventListener('click', e => {
      distros[+e.target.dataset.di].paths.push('');
      renderDistros();
    });
  });
  container.querySelectorAll('.worktree-default').forEach(el => {
    el.addEventListener('change', e => {
      distros[+e.target.dataset.di].worktreeDefault = e.target.checked;
    });
  });
}

function pathRow(di, pi, path) {
  return `<div class="path-row">
    <input class="path-input" value="${escHtml(path)}" placeholder="/home/dev/repos/…" data-di="${di}" data-pi="${pi}">
    <button class="remove-path" data-di="${di}" data-pi="${pi}" aria-label="Remove path">✕</button>
  </div>`;
}

function addDistro() {
  distros.push({ name: '', paths: [''], worktreeDefault: false });
  renderDistros();
  renderRules(); // refresh distro options in rule dropdowns
}

function renderRules() {
  const container = document.getElementById('rules-list');
  container.innerHTML = '';
  urlRules.forEach((rule, ri) => {
    const row = document.createElement('div');
    row.className = 'rule-row';

    const patternInput = document.createElement('input');
    patternInput.className = 'rule-pattern';
    patternInput.value = rule.pattern || '';
    patternInput.placeholder = 'e.g. aimclear.biz or github.com/aimclear/amsoil-dlp';
    patternInput.addEventListener('input', e => { urlRules[ri].pattern = e.target.value; });

    const distroSel = document.createElement('select');
    distroSel.className = 'rule-distro';
    distroSel.innerHTML = '<option value="">(select distro)</option>' +
      distros.map(d => `<option value="${escHtml(d.name)}"${d.name === rule.distro ? ' selected' : ''}>${escHtml(d.name)}</option>`).join('');
    distroSel.addEventListener('change', e => { urlRules[ri].distro = e.target.value; });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-rule';
    removeBtn.setAttribute('aria-label', 'Remove rule');
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => { urlRules.splice(ri, 1); renderRules(); });

    row.appendChild(patternInput);
    row.appendChild(distroSel);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

function addRule() {
  urlRules.push({ pattern: '', distro: '' });
  renderRules();
}

async function save() {
  const systemPrompt = document.getElementById('system-prompt').value;
  const validDistros = distros.filter(d => validateDistro(d));
  const validRules = urlRules.filter(r => r.pattern && r.pattern.trim() && r.distro);
  await chrome.storage.sync.set({ systemPrompt, distros: validDistros, urlRules: validRules });
  const status = document.getElementById('save-status');
  status.textContent = 'Saved.';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
