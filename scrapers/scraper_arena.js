// scrapers/scraper_arena.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const outputFile = path.join(__dirname, "..", "docs", "prices", "prices_arena.json");
const productsFile = path.join(__dirname, "..", "products.txt");

// Lê lista de produtos
const produtos = fs.existsSync(productsFile)
  ? fs.readFileSync(productsFile, "utf-8").split("\n").map(p => p.trim()).filter(Boolean)
  : [];

async function fetchPrecoProduto(produto) {
  const searchUrl = `https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Search-Show?q=${encodeURIComponent(produto)}&lang=`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(searchUrl, { waitUntil: "networkidle2" });

  // Espera pelo span do nome do produto (ou timeout 5s)
  await page.waitForSelector("span.productCard__title", { timeout: 5000 }).catch(() => {});

  const resultado = await page.evaluate(() => {
    const titleEl = document.querySelector("span.productCard__title");
    const priceEl = document.querySelector("span.productPrice__price");

    const nome = titleEl ? titleEl.innerText.trim() : null;
    const precoText = priceEl ? priceEl.innerText.trim() : null;
    let preco = null;

    if (precoText) {
      preco = parseFloat(precoText.replace("R$", "").replace(",", ".").replace(/[^\d.]/g, "")) || null;
    }

    return { nome, preco };
  });

  await browser.close();
  return resultado;
}

(async () => {
  const results = [];

  for (const produto of produtos) {
    console.log("Buscando:", produto);
    const { nome, preco } = await fetchPrecoProduto(produto);
    results.push({ produto: nome || produto, preco: preco || 0 });
    console.log("→", nome, preco);
  }

  // Salvar JSON
  if (!fs.existsSync(path.dirname(outputFile))) fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf-8");

  console.log(`💾 Preços da Arena salvos em ${outputFile}`);
})();
