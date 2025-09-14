import chromium from "chrome-aws-lambda";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Abrir site da Tenda
    await page.goto("https://www.tendaatacado.com.br/", { waitUntil: "networkidle2" });

    // Colocar CEP
    await page.waitForSelector("#zipcode"); 
    await page.type("#zipcode", "13187-166");
    await page.click("button[type='submit']");
    await page.waitForTimeout(3000);

    // Selecionar delivery
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

    // Salvar em JSON
    const pricesDir = path.join(process.cwd(), "docs", "prices");
    if (!fs.existsSync(pricesDir)) fs.mkdirSync(pricesDir, { recursive: true });
    fs.writeFileSync(path.join(pricesDir, "prices_tenda.json"), JSON.stringify({ produto, preco }, null, 2));

    res.status(200).json({ produto, preco });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produto" });
  } finally {
    if (browser) await browser.close();
  }
}
