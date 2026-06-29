# 💧 Copasa Abastece — Monitor

[![Update Alerts](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js/actions/workflows/update.yml/badge.svg)](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js/actions/workflows/update.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-blue?logo=github)](https://danhpaiva.github.io/copasa-abastece-scraping-service-html-css-js/)

🇧🇷 [Português](#português) · 🇺🇸 [English](#english)

---

## Português

Página estática publicada no **GitHub Pages** que exibe em tempo real as interrupções no abastecimento de água da Copasa para as cidades monitoradas.

Os dados são coletados pelo scraper Python [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) e atualizados automaticamente a cada hora via **GitHub Actions**.

### Funcionalidades

- Status visual destacado: verde (sem interrupções) ou vermelho (com alerta ativo)
- Contador regressivo até o fim de cada interrupção ("Termina em 4h 30min")
- Card transiciona automaticamente de **ATIVO → ENCERRADO** quando o contador chega a zero, sem esperar o pipeline
- Busca por bairro: filtra os alertas em tempo real e posiciona o bairro encontrado em primeiro lugar
- Bairros afetados com nomes acentuados e expansão de lista ("+ N mais") para alertas com muitos bairros
- Cidades monitoradas exibidas no rodapé, lidas dinamicamente do `bairros.json`
- Botão "Verificar agora" com cooldown de 3 minutos e feedback visual: "✓ Sem novidades" ou "✓ Dados atualizados"
- Indicador de dados desatualizados (pipeline com problema)
- Auto-refresh silencioso a cada 30 minutos
- Tema claro/escuro com detecção automática do sistema operacional
- Cache offline via localStorage e Service Worker (PWA instalável)
- Cache do Service Worker atualizado automaticamente a cada deploy
- Disclaimer de serviço não oficial no rodapé
- Compatível com mobile, tablet e desktop

### Estrutura do projeto

```
.
├── index.html                    # Página principal (raiz — exigido pelo GitHub Pages)
├── sw.js                         # Service Worker (raiz — exigido pelo escopo do PWA)
├── manifest.json                 # Web App Manifest (instalável no celular)
├── alerts.json                   # Dados gerados pelo scraper (auto-atualizado)
├── bairros.json                  # Cidades e bairros monitorados (configure aqui)
├── assets/
│   ├── app.js                    # Lógica de fetch, renderização e interatividade
│   ├── style.css                 # Estilos (mobile-first, sem dependências)
│   └── icon.svg                  # Ícone do app (PWA + favicon)
└── .github/
    └── workflows/
        └── update.yml            # GitHub Action: CI + scrape + CD (cron horário)
```

### Como funciona

```
GitHub Actions (cron: toda hora)
    │
    ├── CI: valida arquivos obrigatórios e JSONs
    ├── Baixa scraper.py do repositório copasa-abastece-scraping-service-py
    ├── Executa: python scraper.py --output /tmp/alerts_raw.json
    │     (lê bairros.json para saber quais cidades/bairros monitorar)
    ├── Empacota resultado em alerts.json (com campo gerado_em)
    ├── Injeta timestamp de deploy no footer do index.html (horário de Brasília)
    ├── Atualiza versão do cache no sw.js (força bust em cada deploy)
    ├── Commita e faz push se houve mudança
    └── CD: publica o site via GitHub Pages
          │
          └── Browser carrega a página
                ├── Busca bairros.json para exibir cidades e corrigir acentuação
                ├── Exibe cache do localStorage imediatamente (sem flash)
                ├── Faz fetch do alerts.json atualizado
                ├── Service Worker serve assets offline
                └── Auto-refresh silencioso a cada 30min
```

### Formato do `alerts.json`

```json
{
  "gerado_em": "2026-06-28T14:30:00",
  "alertas": [
    {
      "titulo": "28/06 - BELO HORIZONTE - Situação do Abastecimento",
      "url": "https://www.copasa.com.br/...",
      "cidades": ["Belo Horizonte", "Contagem"],
      "inicio": "2026-06-28T06:00:00",
      "fim": "2026-06-30T07:00:00",
      "esta_ativa": true,
      "bairros_afetados": ["Nazare", "Sao Gabriel", "Vista do Sol"]
    }
  ]
}
```

> `bairros_afetados` contém os nomes dos bairros normalizados (sem acentos), conforme retornados pelo scraper. A acentuação correta é restaurada pelo frontend via `display_names` no `bairros.json`.

### Configurar no seu repositório

**1. Configurar as cidades e bairros monitorados**

Edite o [`bairros.json`](bairros.json) na raiz deste repositório:

```json
{
  "bairros": [],
  "aliases": {},
  "cidades_alvo": [
    "Belo Horizonte", "Contagem", "Nova Lima", "Raposos",
    "Ribeirao das Neves", "Sabara", "Santa Luzia", "Vespasiano"
  ],
  "display_names": {
    "Sao Gabriel": "São Gabriel",
    "Nazare": "Nazaré",
    "Sabara": "Sabará"
  }
}
```

- **`cidades_alvo`** — exibe alertas que afetam qualquer uma dessas cidades (sem acentos, conforme normalizado pelo scraper)
- **`bairros`** — lista de bairros específicos a destacar dentro dos alertas encontrados (sem acentos). Deixe `[]` para mostrar todos os alertas das cidades sem filtro por bairro
- **`aliases`** — variações de grafia que o scraper deve tratar como o mesmo bairro
- **`display_names`** — mapa de nomes normalizados para nomes com acentuação correta, usado pelo frontend para exibição

**2. Habilitar o GitHub Pages**

No repositório → **Settings → Pages → Source**: selecione **GitHub Actions**.

**3. Ativar permissões de escrita para o Actions**

**Settings → Actions → General → Workflow permissions** → marque **Read and write permissions**.

**4. Disparar manualmente (primeira vez)**

Acesse **Actions → Update Alerts → Run workflow** para forçar uma execução imediata. Após isso o cron horário assume.

### Desenvolvimento local

Qualquer servidor HTTP estático funciona:

```bash
# Python
python -m http.server 3000

# Node.js (npx, sem instalação prévia)
npx serve .
```

Acesse `http://localhost:3000`. O `alerts.json` já contém dados de exemplo para desenvolvimento local.

> O Service Worker só é registrado em contexto seguro (HTTPS ou localhost), portanto funciona normalmente em desenvolvimento local.

### Dependências

**Nenhuma no frontend.** HTML + CSS + JS puros, sem npm, sem build step, sem frameworks.

O PWA (Service Worker + manifest) é implementado nativamente, sem bibliotecas externas.

A GitHub Action instala `playwright`, `requests` e `beautifulsoup4` apenas no ambiente de CI para rodar o scraper.

### Repositórios relacionados

| Repositório                                                                                                                 | Descrição                                    |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py)                   | Scraper Python que coleta os dados da Copasa |
| [`copasa-abastece-scraping-service-html-css-js`](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js) | Este repositório — frontend estático         |

### Aviso legal

> ⚠ **Este não é um serviço oficial da Copasa.**
>
> Este projeto é independente, sem fins lucrativos e sem vínculo com a [Copasa](https://www.copasa.com.br). Os dados são obtidos automaticamente do site oficial da Copasa e podem apresentar atraso de até 1 hora ou inconsistências. Não nos responsabilizamos por decisões tomadas com base nas informações exibidas. Consulte sempre os canais oficiais da Copasa para informações definitivas.

---

## English

A static page published on **GitHub Pages** that displays real-time water supply interruptions from Copasa for the monitored cities.

Data is collected by the Python scraper [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) and automatically updated every hour via **GitHub Actions**.

### Features

- Highlighted visual status: green (no interruptions) or red (active alert)
- Countdown timer until the end of each interruption ("Ends in 4h 30min")
- Card automatically transitions from **ACTIVE → ENDED** when the countdown reaches zero, without waiting for the pipeline
- Neighborhood search: filters alerts in real time and positions the matched neighborhood first
- Affected neighborhoods with accented names and list expansion ("+ N more") for alerts with many neighborhoods
- Monitored cities displayed in the footer, dynamically read from `bairros.json`
- "Check now" button with a 3-minute cooldown and visual feedback: "✓ No updates" or "✓ Data updated"
- Stale data indicator (pipeline issue)
- Silent auto-refresh every 30 minutes
- Light/dark theme with automatic OS detection
- Offline cache via localStorage and Service Worker (installable PWA)
- Service Worker cache automatically updated on every deploy
- Unofficial service disclaimer in the footer
- Compatible with mobile, tablet and desktop

### Project structure

```
.
├── index.html                    # Main page (root — required by GitHub Pages)
├── sw.js                         # Service Worker (root — required by PWA scope)
├── manifest.json                 # Web App Manifest (installable on mobile)
├── alerts.json                   # Data generated by the scraper (auto-updated)
├── bairros.json                  # Monitored cities and neighborhoods (configure here)
├── assets/
│   ├── app.js                    # Fetch logic, rendering and interactivity
│   ├── style.css                 # Styles (mobile-first, no dependencies)
│   └── icon.svg                  # App icon (PWA + favicon)
└── .github/
    └── workflows/
        └── update.yml            # GitHub Action: CI + scrape + CD (hourly cron)
```

### How it works

```
GitHub Actions (cron: every hour)
    │
    ├── CI: validates required files and JSONs
    ├── Downloads scraper.py from the copasa-abastece-scraping-service-py repository
    ├── Runs: python scraper.py --output /tmp/alerts_raw.json
    │     (reads bairros.json to determine which cities/neighborhoods to monitor)
    ├── Packages result into alerts.json (with gerado_em field)
    ├── Injects deploy timestamp into index.html footer (Brasília time)
    ├── Updates cache version in sw.js (forces cache bust on every deploy)
    ├── Commits and pushes if there were changes
    └── CD: publishes the site via GitHub Pages
          │
          └── Browser loads the page
                ├── Fetches bairros.json to display cities and fix accents
                ├── Immediately renders localStorage cache (no flash)
                ├── Fetches the updated alerts.json
                ├── Service Worker serves assets offline
                └── Silent auto-refresh every 30 minutes
```

### `alerts.json` format

```json
{
  "gerado_em": "2026-06-28T14:30:00",
  "alertas": [
    {
      "titulo": "28/06 - BELO HORIZONTE - Situação do Abastecimento",
      "url": "https://www.copasa.com.br/...",
      "cidades": ["Belo Horizonte", "Contagem"],
      "inicio": "2026-06-28T06:00:00",
      "fim": "2026-06-30T07:00:00",
      "esta_ativa": true,
      "bairros_afetados": ["Nazare", "Sao Gabriel", "Vista do Sol"]
    }
  ]
}
```

> `bairros_afetados` contains neighborhood names normalized (without accents), as returned by the scraper. Correct accents are restored by the frontend via `display_names` in `bairros.json`.

### Setting up in your repository

**1. Configure monitored cities and neighborhoods**

Edit [`bairros.json`](bairros.json) at the root of this repository:

```json
{
  "bairros": [],
  "aliases": {},
  "cidades_alvo": [
    "Belo Horizonte", "Contagem", "Nova Lima", "Raposos",
    "Ribeirao das Neves", "Sabara", "Santa Luzia", "Vespasiano"
  ],
  "display_names": {
    "Sao Gabriel": "São Gabriel",
    "Nazare": "Nazaré",
    "Sabara": "Sabará"
  }
}
```

- **`cidades_alvo`** — shows alerts affecting any of these cities (without accents, as normalized by the scraper)
- **`bairros`** — list of specific neighborhoods to highlight within found alerts (without accents). Leave `[]` to show all city alerts without neighborhood filtering
- **`aliases`** — spelling variations the scraper should treat as the same neighborhood
- **`display_names`** — map of normalized names to correctly accented display names, used by the frontend

**2. Enable GitHub Pages**

In the repository → **Settings → Pages → Source**: select **GitHub Actions**.

**3. Enable write permissions for Actions**

**Settings → Actions → General → Workflow permissions** → check **Read and write permissions**.

**4. Trigger manually (first time)**

Go to **Actions → Update Alerts → Run workflow** to force an immediate run. After that the hourly cron takes over.

### Local development

Any static HTTP server works:

```bash
# Python
python -m http.server 3000

# Node.js (npx, no prior installation needed)
npx serve .
```

Open `http://localhost:3000`. The `alerts.json` already contains sample data for local development.

> The Service Worker is only registered in a secure context (HTTPS or localhost), so it works normally in local development.

### Dependencies

**None on the frontend.** Pure HTML + CSS + JS, no npm, no build step, no frameworks.

The PWA (Service Worker + manifest) is implemented natively, without external libraries.

The GitHub Action installs `playwright`, `requests` and `beautifulsoup4` only in the CI environment to run the scraper.

### Related repositories

| Repository                                                                                                                  | Description                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py)                   | Python scraper that collects data from Copasa   |
| [`copasa-abastece-scraping-service-html-css-js`](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js) | This repository — static frontend               |

### Legal disclaimer

> ⚠ **This is not an official Copasa service.**
>
> This project is independent, non-profit and has no affiliation with [Copasa](https://www.copasa.com.br). Data is automatically fetched from the official Copasa website and may be up to 1 hour delayed or contain inconsistencies. We are not responsible for any decisions made based on the information displayed. Always consult official Copasa channels for definitive information.
