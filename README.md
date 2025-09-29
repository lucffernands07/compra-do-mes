# 🛒 Compra do Mês

## Comparador de Preços de Supermercados de Hortolândia-SP 

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)](https://nodejs.org/)  
Um **robô de busca de preços** que compara automaticamente os valores de uma lista de produtos entre diferentes supermercados on-line.

---

## ✨ Funcionalidades

✅ Faz **web scraping** nos sites dos supermercados configurados (ex.: GoodBom, Savegnago, Tenda, Arena).  
✅ Lê automaticamente os produtos listados em [`products.txt`](./products.txt).  
✅ Calcula o **preço por kg/L** para padronizar a comparação.  
✅ Gera arquivos **JSON** prontos para visualização no front-end estático.  
✅ Publica os preços atualizados em `docs/` para serem servidos no **GitHub Pages**.  
✅ Workflow com **GitHub Actions** para atualização automática (CI/CD).

---

### ⚡ Automação

Este projeto utiliza **GitHub Actions** para rodar os scrapers de preços automaticamente.  
- ⏱️ **Agendamento:** a cada **2 horas** (`cron: "0 */2 * * *"`)  
- 🔄 **Processo:** executa os scripts de scraping, atualiza os arquivos JSON com os preços mais recentes  
- ☁️ **Hospedagem:** o resultado é salvo automaticamente na pasta `/docs/prices` e publicado via **GitHub Pages**
🌐 https://lucffernands07.github.io/compra-do-mes/

---

## 🗂️ Estrutura do Projeto
```
📦 compra-do-mes
├─ 📁 docs/
│  ├─ 📁 prices/
│  │   ├─ compare.json
│  │   ├─ prices_goodbom.json
│  │   ├─ prices_savegnago.json
│  │ . ├─ prices_arena.json
│  │   └─ prices_tenda.json
│  ├─ index.html
│  ├─ style.css
│  └─ script.js
├─ 📁 scrapers/
│  ├─ compare.js
│  ├─ scraper_goodbom.js
│  ├─ scraper_savegnago.js
│. ├─ scraper_arena.js
│  └─ scraper_tenda.js
├─ 📁.github/
│  └─ workflows/
│      └─ scrape.yml
├─ products.txt
├─ package.json
└─ README.md
```
---

## 🚀 Como Rodar Localmente

> **Pré-requisitos:**  
> - [Node.js](https://nodejs.org/) 18+  
> - [Puppeteer](https://pptr.dev/) (instalado via `npm install`)

```bash
# 1️⃣ Instalar dependências
npm install

# 2️⃣ Editar a lista de produtos
nano products.txt   # ou qualquer editor de texto

# 3️⃣ Executar um scraper específico
node scrapers/scraper_goodbom.js
node scrapers/scraper_savegnago.js

# 4️⃣ Abrir o front-end localmente
# basta abrir docs/index.html no navegador

Os resultados são gravados em docs/prices/*.json e podem ser consumidos pelo front-end automaticamente.


---

⚡ Atualização Automática (GitHub Actions)

Toda vez que houver push na branch principal, a Action scrape.yml executa:

1. Roda todos os scrapers.


2. Atualiza os arquivos em docs/prices/.


3. Faz commit automático com [skip ci] para não gerar loop.




Isso garante preços sempre atualizados no GitHub Pages sem intervenção manual.
```

---

### 🧩 Tecnologias Utilizadas

Node.js	Ambiente de execução dos scrapers
Puppeteer	Automação de navegação e scraping
GitHub Actions	CI/CD para atualização automática
HTML/CSS/JS	Front-end estático (GitHub Pages)

---

### 💡 Dica:
Para incluir novos supermercados basta criar um novo arquivo em scrapers/ seguindo o padrão dos existentes e adicioná-lo ao workflow do GitHub.

---

# 📜 Licença & Uso

Este é um **projeto pessoal**, desenvolvido apenas para **uso próprio** e estudo.  
📌 **Não é permitido** copiar, redistribuir ou utilizar o código sem autorização prévia.

### 🌐 Fontes de preços
Os dados de preços são coletados de sites públicos dos supermercados:

- 🛒 [GoodBom](https://www.supermercadosgoodbom.com.br/)
- 🛒 [Tenda Atacado](https://www.tendaatacado.com.br/)
- 🛒 [Arena Atacado](https://www.arenasuper.com.br/)
- 🛒 [Savegnago](https://www.savegnago.com.br/)

### ⚠️ Aviso Legal
As marcas, nomes e sites mencionados pertencem exclusivamente aos seus **respectivos proprietários**.  
Este projeto **não possui vínculo**, **parceria** ou **endosso oficial** de nenhuma dessas empresas.
