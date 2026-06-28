# 💧 Copasa Abastece — Monitor

[![Update Alerts](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js/actions/workflows/update.yml/badge.svg)](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js/actions/workflows/update.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-blue?logo=github)](https://danhpaiva.github.io/copasa-abastece-scraping-service-html-css-js/)

Página estática publicada no **GitHub Pages** que exibe em tempo real as interrupções no abastecimento de água da Copasa para os bairros monitorados.

Os dados são coletados pelo scraper Python [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) e atualizados automaticamente a cada hora via **GitHub Actions**.

---

## Estrutura do projeto

```
.
├── index.html                    # Página principal
├── style.css                     # Estilos (mobile-first, sem dependências)
├── app.js                        # Lógica de fetch e renderização
├── alerts.json                   # Dados gerados pelo scraper (auto-atualizado)
├── bairros.json                  # Bairros e cidades monitorados (configure aqui)
└── .github/
    └── workflows/
        └── update.yml            # GitHub Action que roda o scraper a cada hora
```

---

## Como funciona

```
GitHub Actions (cron: toda hora)
    │
    ├── CI: valida arquivos obrigatórios e JSONs
    ├── Baixa scraper.py do repositório copasa-abastece-scraping-service-py
    ├── Executa: python scraper.py --output /tmp/alerts_raw.json
    │     (lê bairros.json deste repositório para saber o que monitorar)
    ├── Empacota resultado em alerts.json (com campo gerado_em)
    ├── Commita e faz push se houve mudança
    └── CD: publica o site via GitHub Pages
          │
          └── Browser lê alerts.json via fetch() e renderiza os cards
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

---

## Configurar no seu repositório

### 1. Configurar os bairros monitorados

Edite o [`bairros.json`](bairros.json) na raiz deste repositório:

```json
{
  "bairros": ["Nome Do Bairro", "Outro Bairro"],
  "aliases": {
    "Grafia Alternativa": "Nome Do Bairro"
  },
  "cidades_alvo": ["Belo Horizonte"]
}
```

- **`bairros`** — lista de bairros a monitorar (sem acentos, como aparecem no site da Copasa)
- **`aliases`** — variações de grafia que o scraper deve tratar como o mesmo bairro
- **`cidades_alvo`** — restringe a busca a essas cidades; deixe vazio `[]` para monitorar todas

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

---

## Dependências

**Nenhuma no frontend.** HTML + CSS + JS puros, sem npm, sem build step, sem frameworks.

A GitHub Action instala `playwright`, `requests` e `beautifulsoup4` apenas no ambiente de CI para rodar o scraper.

---

## Repositórios relacionados

| Repositório | Descrição |
|---|---|
| [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) | Scraper Python que coleta os dados da Copasa |
| [`copasa-abastece-scraping-service-html-css-js`](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js) | Este repositório — frontend estático |
