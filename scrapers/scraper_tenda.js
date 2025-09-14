const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  try {
    // Abrir URL do Bacon
    await page.goto("https://www.tendaatacado.com.br/busca?q=Bacon", { waitUntil: "networkidle2" });

    // Esperar produtos carregarem
    await page.waitForSelector("a.showcase-card-content", { timeout: 10000 });

    // Capturar os 3 primeiros produtos
    const items = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("a.showcase-card-content")).slice(0, 3);
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

    // Salvar JSON
    const outDir = path.join(__dirname, "..", "docs", "prices");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_tenda.json"), JSON.stringify(items, null, 2));

    console.log("💾 Preços do Bacon salvos com sucesso:", items);
  } catch (err) {
    console.error("❌ Erro no scraper:", err.message);
  } finally {
    await browser.close();
  }
}

// Executar scraper
main();
