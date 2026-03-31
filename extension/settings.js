// extension/settings.js
let distros = [];

async function init() {
  const stored = await chrome.storage.sync.get(['systemPrompt', 'distros']);
  document.getElementById('system-prompt').value = stored.systemPrompt || '';
  distros = stored.distros || [];
  renderDistros();
  document.getElementById('add-distro-btn').addEventListener('click', addDistro);
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
}

function pathRow(di, pi, path) {
  return `<div class="path-row">
    <input class="path-input" value="${escHtml(path)}" placeholder="/home/dev/repos/…" data-di="${di}" data-pi="${pi}">
    <button class="remove-path" data-di="${di}" data-pi="${pi}" aria-label="Remove path">✕</button>
  </div>`;
}

function addDistro() {
  distros.push({ name: '', paths: [''] });
  renderDistros();
}

async function save() {
  const systemPrompt = document.getElementById('system-prompt').value;
  const validDistros = distros.filter(d => validateDistro(d));
  await chrome.storage.sync.set({ systemPrompt, distros: validDistros });
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
