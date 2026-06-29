'use strict';

const ALERTS_URL          = './alerts.json';
const BAIRROS_URL         = './bairros.json';
const CACHE_KEY           = 'copasa_alerts_cache';
const THEME_KEY           = 'copasa_theme';
const TITLE_BASE          = 'Copasa Abastece — Monitor de Interrupções';
const REFRESH_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutos

let _displayNames = {};  // mapa normalizado → nome com acentos

const $ = (sel, ctx = document) => ctx.querySelector(sel);

// Intervalos ativos de countdown, para limpar ao recarregar
const _timers = [];

// Bairros selecionados no filtro (conjunto vazio = todos)
const _filtro = new Set();

// ── Tema ───────────────────────────────────────────────
function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('#btn-theme').textContent = dark ? '☀️' : '🌙';
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark  = saved !== null ? saved === 'dark' : systemPrefersDark();
  applyTheme(dark);

  // Acompanha mudança de preferência do sistema (sem salvar override)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (localStorage.getItem(THEME_KEY) === null) applyTheme(e.matches);
  });
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next   = !isDark;
  localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  applyTheme(next);
}

// ── Cache ──────────────────────────────────────────────
function cacheLoad() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheSave(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

// ── Badge dinâmico no título ───────────────────────────
function updateTitle(ativos) {
  document.title = ativos > 0
    ? `(⚠ ${ativos} alerta${ativos > 1 ? 's' : ''}) ${TITLE_BASE}`
    : TITLE_BASE;
}

function _fmtDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatDate(isoString) {
  if (!isoString) return 'Desconhecida';
  // gerado_em é UTC mas vem sem 'Z' — força interpretação correta
  const utc = isoString.endsWith('Z') ? isoString : isoString + 'Z';
  const d = new Date(utc);
  return isNaN(d) ? isoString : _fmtDate(d);
}

function formatDateShort(isoString) {
  if (!isoString) return '–';
  const d = new Date(isoString);
  return isNaN(d) ? isoString : _fmtDate(d);
}

function formatCountdown(ms) {
  if (ms <= 0) return 'encerrando…';
  const totalMin = Math.floor(ms / 60000);
  const days  = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins  = totalMin % 60;

  if (days > 0)  return `${days}d ${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

function expireCard(card) {
  card.classList.replace('active', 'inactive');

  const badge = card.querySelector('.badge');
  if (badge) {
    badge.classList.replace('active', 'inactive');
    badge.textContent = 'ENCERRADO';
  }

  // Recalcula o banner de status com base nos cards ainda ativos na tela
  const ativos = [...$('#cards-container').querySelectorAll('.card.active')].length;
  updateTitle(ativos);
  if (ativos > 0) {
    setStatus('alert', ativos === 1
      ? '⚠ Há 1 interrupção ativa'
      : `⚠ Há ${ativos} interrupções ativas`
    );
  } else {
    setStatus('ok', '✓ Abastecimento normal — sem interrupções ativas');
  }
}

function startCountdown(el, fimIso) {
  const fim = new Date(fimIso);
  let id;

  function tick() {
    const diff = fim - Date.now();
    el.textContent = formatCountdown(diff);
    if (diff <= 0) {
      el.closest('.countdown')?.classList.add('expired');
      clearInterval(id);
      const card = el.closest('.card');
      if (card?.classList.contains('active')) expireCard(card);
    }
  }

  tick();
  id = setInterval(tick, 30000); // atualiza a cada 30s
  _timers.push(id);
}

// Bairros de todos os alertas carregados (para o filtro de busca)
let _todosBairros = [];
let _alertasAtual = [];
let _lastGeradoEm = null;  // evita re-render desnecessário ao atualizar

function renderFilter(alertas) {
  const bar = $('#filter-bar');

  _todosBairros = [...new Set(
    alertas.flatMap(a => a.bairros_afetados || [])
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  bar.hidden = _todosBairros.length === 0;
}

function wireBtnMore(tagList) {
  const btnMore = tagList.querySelector('.btn-tag-more');
  if (!btnMore) return;
  btnMore.addEventListener('click', () => {
    const extra = btnMore.previousElementSibling;
    const expanded = extra.hidden;
    extra.hidden = !expanded;
    btnMore.setAttribute('aria-expanded', expanded);
    btnMore.textContent = expanded
      ? `▴ recolher`
      : `+ ${extra.querySelectorAll('.tag').length} mais ▾`;
  });
}

function rebuildBairrosTagList(card, bairros) {
  const rows = card.querySelectorAll('.detail-row');
  let bairrosRow = null;
  rows.forEach(row => {
    const label = row.querySelector('.detail-label');
    if (label && label.textContent === 'Bairros afetados') bairrosRow = row;
  });
  if (!bairrosRow) return;
  const tagList = bairrosRow.querySelector('.tag-list');
  if (!tagList) return;
  tagList.innerHTML = buildBairrosHtml(bairros);
  wireBtnMore(tagList);
}

function applyFilter(alertas) {
  const query = ($('#filter-input')?.value || '').trim().toLowerCase();
  const cards = [...$('#cards-container').querySelectorAll('.card')];

  cards.forEach(card => {
    const bairros = JSON.parse(card.dataset.bairros || '[]');

    if (!query) {
      card.hidden = false;
      // restaura ordem original
      if (bairros.length > 0) rebuildBairrosTagList(card, bairros);
      return;
    }

    const matched = bairros.filter(b => b.toLowerCase().includes(query));
    card.hidden = matched.length === 0;

    if (!card.hidden && matched.length > 0) {
      const rest = bairros.filter(b => !b.toLowerCase().includes(query));
      rebuildBairrosTagList(card, [...matched, ...rest]);
    }
  });

  // Atualiza contador de resultados visíveis
  const visíveis = cards.filter(c => !c.hidden).length;
  const hint = $('#filter-hint');
  if (hint) hint.textContent = query
    ? `${visíveis} alerta${visíveis !== 1 ? 's' : ''} encontrado${visíveis !== 1 ? 's' : ''}`
    : '';
}

function checkStaleData(geradoEm, alertasNovos) {
  const banner = $('#stale-banner');
  const staleText = $('#stale-text');
  if (!geradoEm) { banner.hidden = true; return; }

  const diffMs = Date.now() - new Date(geradoEm + 'Z');
  const diffH  = diffMs / 3600000;

  // Caso 1: dados muito antigos (pipeline parado)
  if (diffH >= 2) {
    const h = Math.floor(diffH);
    banner.hidden = false;
    staleText.textContent =
      `Dados com ${h}h de atraso — o pipeline pode estar com problema. `;
    return;
  }

  // Caso 2: dados frescos mas zerados — havia alertas ativos antes (possível falha do scraper)
  const haviamAtivos = _alertasAtual.some(a => a.esta_ativa);
  if ((alertasNovos || []).length === 0 && haviamAtivos) {
    banner.hidden = false;
    staleText.textContent =
      `Dados recém-atualizados indicam 0 alertas, mas havia interrupções ativas. ` +
      `Possível instabilidade no site da Copasa — dados anteriores podem ser mais precisos. `;
    return;
  }

  banner.hidden = true;
}

function setStatus(type, text) {
  const banner = $('#status-banner');
  banner.className = `status-banner ${type}`;
  $('#status-text').textContent = text;
}

function renderCards(alertas) {
  _timers.forEach(clearInterval);
  _timers.length = 0;

  const container = $('#cards-container');
  container.innerHTML = '';

  if (!alertas || alertas.length === 0) {
    container.innerHTML = `
      <div class="state-card">
        <span class="icon">📋</span>
        <p><strong>Nenhum alerta registrado</strong><br>
        O scraper não encontrou interrupções para os bairros monitorados.</p>
      </div>`;
    return;
  }

  // Ordena: ativos primeiro, depois por início decrescente
  const sorted = [...alertas].sort((a, b) => {
    if (a.esta_ativa !== b.esta_ativa) return a.esta_ativa ? -1 : 1;
    return new Date(b.inicio) - new Date(a.inicio);
  });

  sorted.forEach((alerta, i) => {
    const card = buildCard(alerta);
    card.style.animationDelay = `${i * 80}ms`;
    container.appendChild(card);

    if (alerta.esta_ativa && alerta.fim) {
      const el = card.querySelector('.countdown-value');
      if (el) startCountdown(el, alerta.fim);
    }
  });

  _alertasAtual = alertas;
  renderFilter(alertas);
  applyFilter(alertas);
}

const BAIRROS_VISIVEIS = 5;

function displayBairro(b) {
  return _displayNames[b] || b;
}

function buildBairrosHtml(bairros) {
  const visiveis = bairros.slice(0, BAIRROS_VISIVEIS);
  const restantes = bairros.slice(BAIRROS_VISIVEIS);
  const tagsVisiveis = visiveis.map(b => `<span class="tag bairro">${esc(displayBairro(b))}</span>`).join('');

  if (restantes.length === 0) return tagsVisiveis;

  const tagsRestantes = restantes.map(b => `<span class="tag bairro">${esc(displayBairro(b))}</span>`).join('');
  return `
    ${tagsVisiveis}
    <span class="tag-more-wrap">
      <span class="tags-extra" hidden>${tagsRestantes}</span>
      <button class="btn-tag-more" aria-expanded="false">+ ${restantes.length} mais ▾</button>
    </span>`;
}

function buildCard(alerta) {
  const isActive = alerta.esta_ativa;
  const card = document.createElement('article');
  card.className = `card${isActive ? ' active' : ' inactive'}`;

  const cidades = (alerta.cidades || []).map(c =>
    `<span class="tag city">${esc(c)}</span>`).join('');

  const bairrosAfetados = alerta.bairros_afetados || [];
  card.dataset.bairros = JSON.stringify(bairrosAfetados);
  const BAIRROS_VISIVEIS = 5;
  const bairrosHtml = bairrosAfetados.length > 0
    ? buildBairrosHtml(bairrosAfetados)
    : null;

  const tituloHtml = alerta.url
    ? `<a href="${esc(alerta.url)}" target="_blank" rel="noopener">${esc(alerta.titulo)}</a>`
    : esc(alerta.titulo);

  const countdownInicial = isActive && alerta.fim
    ? formatCountdown(new Date(alerta.fim) - Date.now())
    : null;
  const countdownHtml = countdownInicial !== null
    ? `<div class="detail-row">
        <span class="detail-label">Termina em</span>
        <div class="countdown">
          <span class="countdown-value">${esc(countdownInicial)}</span>
        </div>
      </div>`
    : '';

  card.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">${tituloHtml}</h2>
      <span class="badge ${isActive ? 'active' : 'inactive'}">
        ${isActive ? 'ATIVO' : 'ENCERRADO'}
      </span>
    </div>
    <div class="card-body">
      ${countdownHtml}
      <div class="detail-row">
        <span class="detail-label">Período</span>
        <div class="period">
          <span>${formatDateShort(alerta.inicio)}</span>
          <span class="period-arrow">→</span>
          <span>${formatDateShort(alerta.fim)}</span>
        </div>
      </div>
      <div class="detail-row">
        <span class="detail-label">Cidades</span>
        <div class="tag-list">${cidades || '<span class="tag none">–</span>'}</div>
      </div>
      ${bairrosHtml ? `
      <div class="detail-row">
        <span class="detail-label">Bairros afetados</span>
        <div class="tag-list">${bairrosHtml}</div>
      </div>` : ''}
    </div>`;

  // Expandir bairros
  const btnMoreEl = card.querySelector('.btn-tag-more');
  if (btnMoreEl) wireBtnMore(btnMoreEl.closest('.tag-list'));

  return card;
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(reason) {
  setStatus('loading', 'Não foi possível carregar os dados');
  $('#cards-container').innerHTML = `
    <div class="state-card">
      <span class="icon">⚠️</span>
      <p><strong>Dados ainda não disponíveis</strong><br>
      ${esc(reason)}<br><br>
      Verifique se o GitHub Actions já executou ao menos uma vez
      e se o arquivo <code>alerts.json</code> foi gerado no repositório.</p>
    </div>`;
  $('#last-updated').textContent = 'Desconhecida';
}

function applyData(data, forceRender = false) {
  // Suporta tanto o formato wrapper { gerado_em, alertas } quanto array legado
  let alertas, geradoEm;
  if (Array.isArray(data)) {
    alertas = data;
    geradoEm = null;
  } else {
    alertas = data.alertas || [];
    geradoEm = data.gerado_em || null;
  }

  $('#last-updated').textContent = geradoEm ? formatDate(geradoEm) : 'Desconhecida';
  checkStaleData(geradoEm, alertas);

  const ativos = alertas.filter(a => a.esta_ativa);
  updateTitle(ativos.length);

  if (ativos.length > 0) {
    setStatus('alert',
      ativos.length === 1
        ? '⚠ Há 1 interrupção ativa'
        : `⚠ Há ${ativos.length} interrupções ativas`
    );
  } else {
    setStatus('ok', '✓ Abastecimento normal — sem interrupções ativas');
  }

  // Só re-renderiza cards se os dados mudaram (evita reiniciar o contador regressivo)
  const dadosMudaram = !geradoEm || geradoEm !== _lastGeradoEm;
  _lastGeradoEm = geradoEm;

  if (dadosMudaram || forceRender) {
    renderCards(alertas);
  }
}

async function load() {
  const cached = cacheLoad();
  if (cached) {
    applyData(cached);   // exibe cache imediatamente — sem flash
  } else {
    setStatus('loading', 'Carregando dados…');
    showSkeleton(2);     // skeleton só quando não há cache
  }

  let data;
  try {
    const res = await fetch(ALERTS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    if (!cached) showError('Falha ao buscar alerts.json: ' + err.message);
    return false; // indica falha
  }

  const geradoEm = Array.isArray(data) ? null : (data.gerado_em || null);
  const mudou = geradoEm !== _lastGeradoEm;

  cacheSave(data);
  applyData(data);
  return mudou;
}

let _cooldownTimer = null;
let _cooldownEnd   = 0;

function startCooldown(btn) {
  _cooldownEnd = Date.now() + REFRESH_COOLDOWN_MS;
  btn.disabled = true;
  btn.classList.remove('spinning');

  _cooldownTimer = setInterval(() => {
    const remaining = Math.ceil((_cooldownEnd - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(_cooldownTimer);
      _cooldownTimer = null;
      btn.disabled = false;
      btn.querySelector('.btn-refresh-icon').textContent = '↻';
      btn.querySelector('.btn-refresh-label').textContent = ' Verificar agora';
    } else {
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      btn.querySelector('.btn-refresh-icon').textContent = '';
      btn.querySelector('.btn-refresh-label').textContent = `Aguarde ${m}:${s}`;
    }
  }, 1000);
}

async function refresh() {
  if (_cooldownTimer || Date.now() < _cooldownEnd) return;

  const btn = $('#btn-refresh');
  btn.disabled = true;
  btn.classList.add('spinning');

  const mudou = await load();

  // Feedback visual por 2s antes de entrar no cooldown
  btn.classList.remove('spinning');
  btn.querySelector('.btn-refresh-icon').textContent = '✓';
  btn.querySelector('.btn-refresh-label').textContent =
    mudou ? ' Dados atualizados' : ' Sem novidades';

  setTimeout(() => startCooldown(btn), 5000);
}

// ── Service Worker ─────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ── Skeleton loading ───────────────────────────────────
function showSkeleton(n = 2) {
  const container = $('#cards-container');
  container.innerHTML = Array.from({ length: n }, () => `
    <div class="card skeleton" aria-hidden="true">
      <div class="card-header">
        <div class="skel-line skel-title"></div>
        <div class="skel-badge"></div>
      </div>
      <div class="card-body">
        <div class="skel-line skel-sm"></div>
        <div class="skel-line skel-md"></div>
        <div class="skel-line skel-sm"></div>
      </div>
    </div>`).join('');
}

// ── Auto-refresh silencioso ────────────────────────────
const AUTO_REFRESH_MS = 30 * 60 * 1000; // 30 minutos

function startAutoRefresh() {
  setInterval(async () => {
    let data;
    try {
      const res = await fetch(ALERTS_URL, { cache: 'no-store' });
      if (!res.ok) return;
      data = await res.json();
    } catch { return; }
    cacheSave(data);
    applyData(data);
  }, AUTO_REFRESH_MS);
}

async function loadBairrosConfig() {
  try {
    const res = await fetch(BAIRROS_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const cfg = await res.json();

    // #4 — mapa de nomes com acentos
    _displayNames = cfg.display_names || {};

    // #2 — exibe cidades monitoradas no rodapé
    const cidades = cfg.cidades_alvo || [];
    const el = $('#cidades-monitoradas');
    if (el && cidades.length > 0) {
      el.textContent = 'Monitorando: ' + cidades.join(', ');
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
  registerSW();
  initTheme();
  await loadBairrosConfig();
  load();
  startAutoRefresh();
  $('#btn-refresh').addEventListener('click', refresh);
  $('#btn-theme').addEventListener('click', toggleTheme);

  $('#filter-input').addEventListener('input', () => applyFilter(_alertasAtual));
  $('#filter-input').addEventListener('search', () => applyFilter(_alertasAtual));
});
