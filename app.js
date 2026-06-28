'use strict';

const ALERTS_URL = './alerts.json';

const $ = (sel, ctx = document) => ctx.querySelector(sel);

// Intervalos ativos de countdown, para limpar ao recarregar
const _timers = [];

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

  sorted.forEach(alerta => {
    const card = buildCard(alerta);
    container.appendChild(card);

    if (alerta.esta_ativa && alerta.fim) {
      const el = card.querySelector('.countdown-value');
      if (el) startCountdown(el, alerta.fim);
    }
  });
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

async function load() {
  setStatus('loading', 'Carregando dados…');

  let data;
  try {
    const res = await fetch(ALERTS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    showError('Falha ao buscar alerts.json: ' + err.message);
    return;
  }

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

  const ativos = alertas.filter(a => a.esta_ativa);

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

async function refresh() {
  const btn = $('#btn-refresh');
  btn.disabled = true;
  btn.classList.add('spinning');
  await load();
  btn.classList.remove('spinning');
  btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  $('#btn-refresh').addEventListener('click', refresh);
});
