// scrapers/scraper_arena.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// URL de exemplo (Bacon)
const buscaProduto = "Bacon";
const urlBusca = `https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Search-Show?q=${encodeURIComponent(buscaProduto)}&lang=`;

// Seletores
const seletorNome = "span.productCard__title";
const seletorPreco = "span.productPrice__price";

// Caminho do JSON de saída
const outputFile = path.join(__dirname, "..", "docs", "prices", "prices_arena.json");

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(urlBusca, { waitUntil: "networkidle2" });

  // Espera os produtos carregarem
  await page.waitForSelector(seletorNome);

  // Extrair produtos e preços
  const produtos = await page.evaluate((seletorNome, seletorPreco) => {
    const nomes = Array.from(document.querySelectorAll(seletorNome)).map(el => el.innerText.trim());
    const precos = Array.from(document.querySelectorAll(seletorPreco)).map(el => el.innerText.trim().replace("R$", "").replace(",", "."));
    const lista = [];
    for (let i = 0; i < nomes.length; i++) {
      lista.push({
        id: nomes[i].toLowerCase().replace(/\s+/g, "_"),
        produto: nomes[i],
        preco: parseFloat(precos[i]) || 0
      });
    }
    return lista;
  }, seletorNome, seletorPreco);

  // Salvar JSON
  if (!fs.existsSync(path.dirname(outputFile))) fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(produtos, null, 2), "utf-8");
  console.log(`💾 Preços Arena salvos em ${outputFile}`);
  
  await browser.close();
})();
