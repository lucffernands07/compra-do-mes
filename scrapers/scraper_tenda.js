const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const page = await browser.newPage();

  await page.goto("https://www.tendaatacado.com.br/", { waitUntil: "networkidle2" });

  // 1️⃣ Abrir input para digitar CEP
  await page.waitForSelector("#searchbarComponent", { timeout: 10000 });
  await page.click("#searchbarComponent");

  // 2️⃣ Digitar CEP
  await page.waitForSelector("#shipping-cep", { timeout: 10000 });
  await page.type("#shipping-cep", "13187166", { delay: 100 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000); // espera modal atualizar

  // 3️⃣ Clicar em Delivery
  await page.waitForSelector(".title-shipping-option", { timeout: 10000 });
  const options = await page.$$(".title-shipping-option");
  for (const opt of options) {
    const txt = await page.evaluate(el => el.innerText, opt);
    if (txt.trim() === "Delivery") {
      await opt.click();
      break;
    }
  }

  await page.waitForTimeout(3000);

  // 4️⃣ Acessar busca do produto
  await page.goto("https://www.tendaatacado.com.br/busca?q=Bacon", { waitUntil: "networkidle2" });

  // Captura o primeiro produto
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

  // Salvar JSON
  const outDir = path.join(__dirname, "..", "docs", "prices");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "prices_tenda.json"), JSON.stringify(item ? [item] : [], null, 2));
  console.log("💾 Preço do Bacon salvo com sucesso!");
}

main().catch(err => console.error(err));
