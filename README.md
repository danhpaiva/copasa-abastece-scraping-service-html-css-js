# 💧 Copasa Abastece — Monitor

[![Update Alerts](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js/actions/workflows/update.yml/badge.svg)](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js/actions/workflows/update.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-blue?logo=github)](https://danhpaiva.github.io/copasa-abastece-scraping-service-html-css-js/)

Página estática publicada no **GitHub Pages** que exibe em tempo real as interrupções no abastecimento de água da Copasa para as cidades monitoradas.

Os dados são coletados pelo scraper Python [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) e atualizados automaticamente a cada hora via **GitHub Actions**.

---

## Funcionalidades

- Status visual destacado: verde (sem interrupções) ou vermelho (com alerta ativo)
- Contador regressivo até o fim de cada interrupção ("Termina em 4h 30min")
- Busca por bairro: filtra os alertas em tempo real e posiciona o bairro encontrado em primeiro lugar
- Bairros afetados com nomes acentuados e expansão de lista ("+ N mais") para alertas com muitos bairros
- Cidades monitoradas exibidas no rodapé, lidas dinamicamente do `bairros.json`
- Botão "Atualizar agora" com cooldown de 3 minutos
- Indicador de dados desatualizados (pipeline com problema)
- Auto-refresh silencioso a cada 30 minutos
- Tema claro/escuro com detecção automática do sistema operacional
- Cache offline via localStorage e Service Worker (PWA instalável)
- Cache do Service Worker atualizado automaticamente a cada deploy
- Compatível com mobile, tablet e desktop

---

## Estrutura do projeto

```
.
├── index.html                    # Página principal
├── style.css                     # Estilos (mobile-first, sem dependências)
├── app.js                        # Lógica de fetch, renderização e SW
├── sw.js                         # Service Worker (cache offline / PWA)
├── manifest.json                 # Web App Manifest (instalável no celular)
├── icon.svg                      # Ícone do app
├── alerts.json                   # Dados gerados pelo scraper (auto-atualizado)
├── bairros.json                  # Cidades e bairros monitorados (configure aqui)
└── .github/
    └── workflows/
        └── update.yml            # GitHub Action: CI + scrape + CD (cron horário)
```

---

## Como funciona

```
GitHub Actions (cron: toda hora)
    │
    ├── CI: valida arquivos obrigatórios e JSONs
    ├── Baixa scraper.py do repositório copasa-abastece-scraping-service-py
    ├── Executa: python scraper.py --output /tmp/alerts_raw.json
    │     (lê bairros.json para saber quais cidades/bairros monitorar)
    ├── Empacota resultado em alerts.json (com campo gerado_em)
    ├── Injeta timestamp de deploy no footer do index.html
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

---

## Formato do `alerts.json`

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

---

## Configurar no seu repositório

### 1. Configurar as cidades e bairros monitorados

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

### 2. Habilitar o GitHub Pages

No repositório → **Settings → Pages → Source**: selecione **GitHub Actions**.

### 3. Ativar permissões de escrita para o Actions

**Settings → Actions → General → Workflow permissions** → marque **Read and write permissions**.

### 4. Disparar manualmente (primeira vez)

Acesse **Actions → Update Alerts → Run workflow** para forçar uma execução imediata. Após isso o cron horário assume.

---

## Desenvolvimento local

Qualquer servidor HTTP estático funciona:

```bash
# Python
python -m http.server 3000

# Node.js (npx, sem instalação prévia)
npx serve .
```

Acesse `http://localhost:3000`. O `alerts.json` já contém dados de exemplo para desenvolvimento local.

> O Service Worker só é registrado em contexto seguro (HTTPS ou localhost), portanto funciona normalmente em desenvolvimento local.

---

## Dependências

**Nenhuma no frontend.** HTML + CSS + JS puros, sem npm, sem build step, sem frameworks.

O PWA (Service Worker + manifest) é implementado nativamente, sem bibliotecas externas.

A GitHub Action instala `playwright`, `requests` e `beautifulsoup4` apenas no ambiente de CI para rodar o scraper.

---

## Repositórios relacionados

| Repositório | Descrição |
|---|---|
| [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) | Scraper Python que coleta os dados da Copasa |
| [`copasa-abastece-scraping-service-html-css-js`](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js) | Este repositório — frontend estático |
