// scrapers/scraper_arena.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// Caminhos
const produtosFile = path.join(__dirname, "..", "products.txt");
const outputFile = path.join(__dirname, "..", "docs", "prices", "prices_arena.json");

// Seletores no site
const seletorNome = "span.productCard__title";
const seletorPreco = "span.productPrice__price";

// Função auxiliar para formatar ID
const formatId = nome => nome.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

(async () => {
  if (!fs.existsSync(produtosFile)) {
    console.error("Arquivo products.txt não encontrado!");
    process.exit(1);
  }

  const produtosLista = fs.readFileSync(produtosFile, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const todosProdutos = [];

  for (const produto of produtosLista) {
    const urlBusca = `https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Search-Show?q=${encodeURIComponent(produto)}&lang=`;
    console.log(`🔎 Buscando: ${produto}`);

    try {
      await page.goto(urlBusca, { waitUntil: "networkidle2" });
      await page.waitForSelector(seletorNome, { timeout: 5000 });

      const encontrados = await page.evaluate((seletorNome, seletorPreco, formatId) => {
        const nomes = Array.from(document.querySelectorAll(seletorNome)).map(el => el.innerText.trim());
        const precos = Array.from(document.querySelectorAll(seletorPreco))
          .map(el => el.innerText.trim().replace("R$", "").replace(",", "."));

        const lista = [];
        for (let i = 0; i < nomes.length; i++) {
          lista.push({
            id: formatId(nomes[i]),
            produto: nomes[i],
            preco: parseFloat(precos[i]) || 0
          });
        }
        return lista;
      }, seletorNome, seletorPreco, formatId);

      todosProdutos.push(...encontrados);
      console.log(`✅ ${encontrados.length} produtos encontrados para "${produto}"`);
    } catch (err) {
      console.warn(`⚠️ Nenhum produto encontrado para "${produto}" ou erro de carregamento.`);
    }
  }

  // Salvar JSON
  if (!fs.existsSync(path.dirname(outputFile))) fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(todosProdutos, null, 2), "utf-8");
  console.log(`💾 Todos os preços Arena salvos em ${outputFile}`);

  await browser.close();
})();
