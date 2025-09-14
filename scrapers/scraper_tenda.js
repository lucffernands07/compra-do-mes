const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  // Abre o site
  await page.goto("https://www.tendaatacado.com.br/", { waitUntil: "domcontentloaded" });

  // Simula CEP
  try {
    await page.waitForSelector("#cep", { timeout: 5000 });
    await page.type("#cep", "13187166", { delay: 100 });
    await page.click("#btn-consultar-cep");
    await page.waitForTimeout(3000);
  } catch {
    console.log("⚠️ CEP já configurado ou seletor não encontrado.");
  }

  // Busca Bacon
  await page.type("#search", "Bacon", { delay: 50 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);

  // Pega o primeiro produto
  const item = await page.evaluate(() => {
    const card = document.querySelector(".product-card");
    if (!card) return null;

    const nome = card.querySelector(".product-card__name")?.innerText.trim();
    const precoTxt = card.querySelector(".best-price")?.innerText.replace("R$", "").replace(",", ".").trim();
    const preco = parseFloat(precoTxt) || 0;

    return {
      produto: nome,
      preco,
      preco_por_kg: preco
    };
  });

  await browser.close();

  // Salva JSON
  const outDir = path.join(__dirname, "..", "docs", "prices");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "prices_tenda.json"), JSON.stringify(item ? [item] : [], null, 2));
  console.log("💾 Preço do Bacon salvo com sucesso!");
}

main().catch(err => console.error(err));
