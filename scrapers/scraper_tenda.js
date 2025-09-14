const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  try {
    // ✅ Direto para a busca do produto
    await page.goto("https://www.tendaatacado.com.br/busca?q=Bacon", { waitUntil: "networkidle2" });

    // Captura o primeiro produto
    const item = await page.evaluate(() => {
      const card = document.querySelector(".product-card");
      if (!card) return null;

      const nome = card.querySelector(".product-card__name")?.innerText.trim();
      const precoTxt = card.querySelector(".best-price")?.innerText.replace("R$", "").replace(",", ".").trim();
      const preco = parseFloat(precoTxt) || 0;

      return { produto: nome, preco, preco_por_kg: preco };
    });

    // Salvar JSON
    const outDir = path.join(__dirname, "..", "docs", "prices");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "prices_tenda.json"),
      JSON.stringify(item ? [item] : [], null, 2)
    );

    console.log("💾 Preço do Bacon salvo com sucesso!");
  } catch (err) {
    console.error("❌ Erro no scraper:", err.message);
  } finally {
    await browser.close();
  }
}

main();
