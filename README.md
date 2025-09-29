
# 🛒 Compra do Mês – Comparador de Preços de Supermercados

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

## 🗂️ Estrutura do Projeto


```
📁 .github
  📁 workflows
    📄 scraper.yml
📁 scrapers
  📄 compare.js
  📄 scraper_tenda.js
  📄 scraper_goodbom.js
  📄 scraper_arena.js
📁 docs
  📄 app.js
  📄 index.html
  📄 style.css
  📁 prices
    📄 compare.json
    📄 prices_tenda.json
    📄 prices_goodbom.json
    📄 prices_arena.json
📄 package.json
📄 products.txt
📄 README.md
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

Aqui vai um README.md bem caprichado para você colocar no GitHub.
Ele usa Markdown + emojis e descreve a estrutura e funcionalidades do projeto de forma clara e profissional:

```
---

# 🛒 Compra do Mês – Comparador de 

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

🧩 Tecnologias Utilizadas

Tecnologia	Uso no Projeto

Node.js	Ambiente de execução dos scrapers
Puppeteer	Automação de navegação e scraping
GitHub Actions	CI/CD para atualização automática
HTML/CSS/JS	Front-end estático (GitHub Pages)



---

📊 Demonstração

💡 Exemplo de resultado exibido no site:

Supermercado	Produto	Preço (R$)	Preço/kg

GoodBom	Arroz 5kg	23.90	4.78
Savegnago	Arroz 5kg	25.50	5.10


(valores meramente ilustrativos)


---

📝 Licença

Este projeto está sob a licença MIT – veja o arquivo LICENSE para mais detalhes.


---

💡 Dica:
Para incluir novos supermercados basta criar um novo arquivo em scrapers/ seguindo o padrão dos existentes e adicioná-lo ao workflow do GitHub.

---

