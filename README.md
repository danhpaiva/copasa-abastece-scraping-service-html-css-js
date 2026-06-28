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
└── .github/
    └── workflows/
        └── update.yml            # GitHub Action que roda o scraper a cada hora
```

---

## Como funciona

```
GitHub Actions (cron: toda hora)
    │
    ├── Baixa scraper.py do repositório copasa-abastece-scraping-service-py
    ├── Executa: python scraper.py --output /tmp/alerts_raw.json
    ├── Empacota resultado em alerts.json (com campo gerado_em)
    └── Commita e faz push se houve mudança
          │
          └── GitHub Pages serve os arquivos estáticos
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
      "url": "https://copasaabastece.com.br/...",
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

### 1. Habilitar o GitHub Pages

No repositório → **Settings → Pages → Source**: selecione a branch `main` e a pasta `/` (root).

### 2. Ativar permissões de escrita para o Actions

**Settings → Actions → General → Workflow permissions** → marque **Read and write permissions**.

### 3. Configurar os bairros monitorados

Edite as variáveis de configuração no [`scraper.py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) conforme a documentação do repositório do scraper.

### 4. Disparar manualmente (opcional)

Acesse **Actions → Update Alerts → Run workflow** para forçar uma execução imediata antes do próximo ciclo de uma hora.

---

## Desenvolvimento local

Qualquer servidor HTTP estático funciona:

```bash
# Python
python -m http.server 3000

# Node.js (npx)
npx serve .
```

Acesse `http://localhost:3000`. O `alerts.json` de exemplo já contém dados fictícios realistas para desenvolvimento.

---

## Dependências

**Nenhuma.** O frontend usa apenas HTML + CSS + JS puros, sem npm, sem build step, sem frameworks.

A GitHub Action instala `playwright`, `requests` e `beautifulsoup4` apenas no ambiente de CI.

---

## Repositórios relacionados

| Repositório | Descrição |
|---|---|
| [`copasa-abastece-scraping-service-py`](https://github.com/danhpaiva/copasa-abastece-scraping-service-py) | Scraper Python que coleta os dados da Copasa |
| [`copasa-abastece-scraping-service-html-css-js`](https://github.com/danhpaiva/copasa-abastece-scraping-service-html-css-js) | Este repositório — frontend estático |
