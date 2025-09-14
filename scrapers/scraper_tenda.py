const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function scrape() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto("https://www.tendaatacado.com.br/", { waitUntil: "networkidle2" });

  // Digitar o CEP
  await page.waitForSelector("#zipcode");
  await page.type("#zipcode", "13187-166");
  await page.click("button[type='submit']");
  await page.waitForTimeout(4000);

  // Selecionar delivery (se aparecer botão)
  const deliveryBtn = await page.$("button.delivery-option");
  if (deliveryBtn) {
    await deliveryBtn.click();
    await page.waitForTimeout(2000);
  }

  // Buscar Bacon
  await page.goto("https://www.tendaatacado.com.br/busca?q=Bacon", { waitUntil: "networkidle2" });
  await page.waitForSelector(".product-card");

  const produto = await page.$eval(".product-card:first-child .product-name", el => el.innerText);
  const preco = await page.$eval(".product-card:first-child .product-price", el => el.innerText);

  const data = { produto, preco, atualizado: new Date().toISOString() };

  // Salvar em docs/prices/prices_tenda.json
  const pricesDir = path.join(__dirname, "..", "docs", "prices");
  if (!fs.existsSync(pricesDir)) fs.mkdirSync(pricesDir, { recursive: true });
  fs.writeFileSync(path.join(pricesDir, "prices_tenda.json"), JSON.stringify(data, null, 2));

  console.log("Preço salvo:", data);

  await browser.close();
}

scrape().catch(err => {
  console.error("Erro no scraper:", err);
  process.exit(1);
});
