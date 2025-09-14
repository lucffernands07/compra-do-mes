const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(15000); // timeout máximo de 15s para cada wait

  try {
    await page.goto("https://www.tendaatacado.com.br/", { waitUntil: "networkidle2" });

    // 1️⃣ Abrir input para digitar CEP
    const searchbar = await page.$("#searchbarComponent");
    if (searchbar) {
      await searchbar.click();
    } else {
      console.log("⚠️ searchbarComponent não encontrado, pulando passo.");
    }

    // 2️⃣ Digitar CEP
    const cepInput = await page.$("#shipping-cep");
    if (cepInput) {
      await cepInput.type("13187166", { delay: 100 });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3000); // esperar modal atualizar
    } else {
      console.log("⚠️ CEP input não encontrado, pulando passo.");
    }

    // 3️⃣ Selecionar Delivery
    const options = await page.$$(".title-shipping-option");
    let clickedDelivery = false;
    for (const opt of options) {
      const txt = await page.evaluate(el => el.innerText, opt);
      if (txt.trim() === "Delivery") {
        await opt.click();
        clickedDelivery = true;
        break;
      }
    }
    if (!clickedDelivery) console.log("⚠️ Delivery não encontrado, pulando passo.");
    await page.waitForTimeout(3000);

    // 4️⃣ Acessar busca do produto Bacon
    await page.goto("https://www.tendaatacado.com.br/busca?q=Bacon", { waitUntil: "networkidle2" });

    // 5️⃣ Captura o primeiro produto
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

    // 6️⃣ Salvar JSON
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
