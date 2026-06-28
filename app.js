'use strict';

const ALERTS_URL          = './alerts.json';
const CACHE_KEY           = 'copasa_alerts_cache';
const THEME_KEY           = 'copasa_theme';
const TITLE_BASE          = 'Copasa Abastece — Monitor de Interrupções';
const REFRESH_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutos

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

function formatDate(isoString) {
  if (!isoString) return 'Desconhecida';
  const d = new Date(isoString);
  if (isNaN(d)) return isoString;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(isoString) {
  if (!isoString) return '–';
  const d = new Date(isoString);
  if (isNaN(d)) return isoString;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

function startCountdown(el, fimIso) {
  const fim = new Date(fimIso);

  function tick() {
    const diff = fim - Date.now();
    el.textContent = formatCountdown(diff);
    if (diff <= 0) el.closest('.countdown')?.classList.add('expired');
  }

  tick();
  const id = setInterval(tick, 30000); // atualiza a cada 30s
  _timers.push(id);
}

function renderFilter(alertas) {
  const bar   = $('#filter-bar');
  const chips = $('#filter-chips');

  // Coleta todos os bairros únicos presentes em qualquer alerta
  const todos = [...new Set(
    alertas.flatMap(a => a.bairros_afetados || [])
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Só exibe o filtro se houver mais de um bairro
  if (todos.length <= 1) { bar.hidden = true; return; }

  chips.innerHTML = '';
  bar.hidden = false;

  // Chip "Todos"
  const all = document.createElement('button');
  all.className = 'chip' + (_filtro.size === 0 ? ' active' : '');
  all.setAttribute('aria-pressed', _filtro.size === 0 ? 'true' : 'false');
  all.textContent = 'Todos';
  all.addEventListener('click', () => {
    _filtro.clear();
    applyFilter(alertas);
    renderFilter(alertas);
  });
  chips.appendChild(all);

  todos.forEach(bairro => {
    const chip = document.createElement('button');
    const isActive = _filtro.has(bairro);
    chip.className = 'chip' + (isActive ? ' active' : '');
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    chip.textContent = bairro;
    chip.addEventListener('click', () => {
      if (_filtro.has(bairro)) {
        _filtro.delete(bairro);
      } else {
        _filtro.add(bairro);
      }
      applyFilter(alertas);
      renderFilter(alertas);
    });
    chips.appendChild(chip);
  });
}

function applyFilter(alertas) {
  // Seleciona todos os cards pelo índice de posição no container
  const cards = [...$('#cards-container').querySelectorAll('.card')];
  const sorted = [...alertas].sort((a, b) => {
    if (a.esta_ativa !== b.esta_ativa) return a.esta_ativa ? -1 : 1;
    return new Date(b.inicio) - new Date(a.inicio);
  });

  cards.forEach((card, i) => {
    if (_filtro.size === 0) {
      card.hidden = false;
      return;
    }
    const bairros = sorted[i]?.bairros_afetados || [];
    card.hidden = !bairros.some(b => _filtro.has(b));
  });
}

function checkStaleData(geradoEm) {
  const banner = $('#stale-banner');
  if (!geradoEm) { banner.hidden = true; return; }

  const diffMs = Date.now() - new Date(geradoEm);
  const diffH  = diffMs / 3600000;

  if (diffH >= 2) {
    const h = Math.floor(diffH);
    banner.hidden = false;
    $('#stale-text').textContent =
      `Dados com ${h}h de atraso — o pipeline pode estar com problema. ` +
      `Verifique o GitHub Actions.`;
  } else {
    banner.hidden = true;
  }
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

  renderFilter(alertas);
  applyFilter(alertas);
}

function buildCard(alerta) {
  const isActive = alerta.esta_ativa;
  const card = document.createElement('article');
  card.className = `card${isActive ? ' active' : ''}`;

  const cidades = (alerta.cidades || []).map(c =>
    `<span class="tag city">${esc(c)}</span>`).join('');

  const bairros = (alerta.bairros_afetados || []).length > 0
    ? alerta.bairros_afetados.map(b => `<span class="tag bairro">${esc(b)}</span>`).join('')
    : '<span class="tag none">Nenhum bairro monitorado afetado</span>';

  const tituloHtml = alerta.url
    ? `<a href="${esc(alerta.url)}" target="_blank" rel="noopener">${esc(alerta.titulo)}</a>`
    : esc(alerta.titulo);

  const countdownHtml = isActive && alerta.fim
    ? `<div class="detail-row">
        <span class="detail-label">Termina em</span>
        <div class="countdown">
          <span class="countdown-value">–</span>
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
      <div class="detail-row">
        <span class="detail-label">Bairros afetados</span>
        <div class="tag-list">${bairros}</div>
      </div>
    </div>`;

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

function applyData(data) {
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
  checkStaleData(geradoEm);

  const ativos = alertas.filter(a => a.esta_ativa);
  updateTitle(ativos.length);

  if (ativos.length > 0) {
    const bairrosText = ativos
      .flatMap(a => a.bairros_afetados || [])
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(', ');

    setStatus('alert',
      ativos.length === 1
        ? `⚠ Há 1 interrupção ativa${bairrosText ? ' — ' + bairrosText : ''}`
        : `⚠ Há ${ativos.length} interrupções ativas`
    );
  } else {
    setStatus('ok', '✓ Abastecimento normal — sem interrupções ativas');
  }

  renderCards(alertas);
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
    return;
  }

  cacheSave(data);
  applyData(data);
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
      btn.querySelector('.btn-refresh-label').textContent = 'Atualizar agora';
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
  await load();
  startCooldown(btn);
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

document.addEventListener('DOMContentLoaded', () => {
  registerSW();
  initTheme();
  load();
  startAutoRefresh();
  $('#btn-refresh').addEventListener('click', refresh);
  $('#btn-theme').addEventListener('click', toggleTheme);
});
