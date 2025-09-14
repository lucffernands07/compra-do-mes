const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Lê lista de produtos
const produtosTxtPath = path.join(__dirname, "..", "productos.txt");
const produtos = fs.readFileSync(produtosTxtPath, "utf-8")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const resultado = [];

  try {
    // Preencher CEP uma vez
    await page.goto("https://www.tendaatacado.com.br", { waitUntil: "networkidle2" });
    await page.waitForSelector("#shipping-cep", { timeout: 10000 });
    await page.type("#shipping-cep", "13187166", { delay: 100 });
    await page.waitForTimeout(2000); // espera carregar Delivery automaticamente

    for (const produto of produtos) {
      console.log(`🔍 Buscando: ${produto}`);

      await page.goto(`https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(produto)}`, { waitUntil: "networkidle2" });
      await page.waitForSelector("a.showcase-card-content", { timeout: 10000 }).catch(() => console.log(`⚠️ Nenhum produto encontrado para ${produto}`));

      const items = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll("a.showcase-card-content"));
        return cards.map(card => {
          const nome = card.querySelector("h3.TitleCardComponent")?.innerText.trim() || null;

          const precoTxt = card.querySelector("div.SimplePriceComponent")?.innerText
            .replace("R$", "")
            .replace(",", ".")
            .replace("un", "")
            .trim();
          const preco = parseFloat(precoTxt) || 0;

          const precoKgTxt = Array.from(card.querySelectorAll("span")).find(s => s.innerText.includes("Valor do kg"))?.innerText
            .replace("Valor do kg: R$", "")
            .replace(",", ".")
            .trim();
          const preco_por_kg = parseFloat(precoKgTxt) || preco;

          return { produto: nome, preco, preco_por_kg };
        });
      });

      // Adiciona todos os itens encontrados
      resultado.push(...items.slice(0, 3)); // opcional: limitar 3 por produto
    }

    // Salvar JSON
    const outDir = path.join(__dirname, "..", "docs", "prices");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_tenda.json"), JSON.stringify(resultado, null, 2));

    console.log("💾 Todos os preços salvos com sucesso!");
  } catch (err) {
    console.error("❌ Erro no scraper:", err.message);
  } finally {
    await browser.close();
  }
}

main();
