const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

async function lerProdutos() {
  const filePath = path.join(__dirname, "..", "products.txt");
  const conteudo = fs.readFileSync(filePath, "utf-8");
  return conteudo.split("\n").map(l => l.trim()).filter(l => l);
}

async function salvarResultados(resultados) {
  const outPath = path.join(__dirname, "..", "docs", "prices", "prices_tenda.json");
  fs.writeFileSync(outPath, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`💾 Salvo em ${outPath}`);
}

async function buscarProduto(page, produto) {
  try {
    await page.goto("https://www.tendaatacado.com.br/", { waitUntil: "domcontentloaded" });

    // Preenche o CEP se necessário
    try {
      await page.waitForSelector("#cep", { timeout: 5000 });
      await page.type("#cep", "13187166", { delay: 100 });
      await page.click("#btn-consultar-cep");
      await page.waitForTimeout(3000);
    } catch (err) {
      console.log("⚠️ CEP já configurado ou seletor não encontrado.");
    }

    // Busca produto
    await page.type("#search", produto, { delay: 50 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(4000);

    // Captura resultados
    const dados = await page.evaluate(() => {
      const itens = [];
      document.querySelectorAll(".product-card").forEach(card => {
        const nome = card.querySelector(".product-card__name")?.innerText.trim();
        const preco = card.querySelector(".best-price")?.innerText.replace("R$", "").replace(",", ".").trim();
        if (nome && preco) {
          itens.push({
            produto: nome,
            preco: parseFloat(preco),
            preco_por_kg: parseFloat(preco) // (ajuste se precisar converter por peso real)
          });
        }
      });
      return itens;
    });

    return dados.length > 0 ? dados[0] : null;
  } catch (err) {
    console.error(`❌ Erro ao buscar "${produto}":`, err.message);
    return null;
  }
}

async function main() {
  const produtos = await lerProdutos();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  const resultados = [];
  for (const produto of produtos) {
    console.log(`🔍 Buscando: ${produto}`);
    const item = await buscarProduto(page, produto);
    if (item) resultados.push(item);
  }

  await browser.close();
  await salvarResultados(resultados);
}

main();
