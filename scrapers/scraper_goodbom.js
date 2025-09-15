const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Caminhos
const produtosTxtPath = path.join(__dirname, "..", "products.txt");
const outDir = path.join(__dirname, "..", "docs", "prices");

// Lê lista de produtos
const produtos = fs.readFileSync(produtosTxtPath, "utf-8")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

// Função para extrair peso em kg do nome do produto
function extrairPeso(nome) {
  const match = nome.toLowerCase().match(/(\d+)\s*g/);
  return match ? parseInt(match[1]) / 1000 : 1; // default 1 kg
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const resultado = [];

  try {
    for (const [index, produto] of produtos.entries()) {
      const id = index + 1; // ID baseado na ordem do products.txt
      console.log(`🔍 Buscando GoodBom: ${produto}`);

      await page.goto(`https://www.goodbom.com.br/hortolandia/busca?q=${encodeURIComponent(produto)}`, { waitUntil: "networkidle2" });

      const items = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("span.product-name"));
        return spans.slice(0, 3).map(span => {
          const nome = span.innerText.trim();
          const precoSpan = span.closest("a")?.querySelector("span.price");
          const precoTxt = precoSpan ? precoSpan.innerText.replace("R$", "").replace(",", ".").trim() : "0";
          const preco = parseFloat(precoTxt) || 0;
          return { nome, preco };
        });
      });

      // Calcular preco_por_kg
      items.forEach(item => {
        const peso_kg = extrairPeso(item.nome);
        resultado.push({
          id,
          supermercado: "Goodbom",
          produto: item.nome,
          preco: item.preco,
          preco_por_kg: parseFloat((item.preco / peso_kg).toFixed(2))
        });
      });
    }

    // Salvar JSON
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_goodbom.json"), JSON.stringify(resultado, null, 2));

    console.log("💾 Preços GoodBom salvos com sucesso!");
  } catch (err) {
    console.error("❌ Erro no scraper GoodBom:", err.message);
  } finally {
    await browser.close();
  }
}

main();
