// scrapers/scraper_arena.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const outputFile = path.join(__dirname, "..", "docs", "prices", "prices_arena.json");
const productsFile = path.join(__dirname, "..", "products.txt");

// Lê lista de produtos
const produtos = fs.existsSync(productsFile)
  ? fs.readFileSync(productsFile, "utf-8").split("\n").map(p => p.trim()).filter(Boolean)
  : [];

// Função auxiliar para extrair e formatar preços
function parsePreco(txt) {
  if (!txt) return 0;
  return parseFloat(
    txt.replace("R$", "").replace(",", ".").replace(/[^\d.]/g, "")
  ) || 0;
}

// Função auxiliar para calcular preço por kg/l se houver
function parsePrecoPorKg(nome, preco) {
  const match = nome.match(/(\d+)[ ]?(g|kg|ml|l)/i);
  if (!match) return preco;
  let quantidade = parseFloat(match[1]);
  const unidade = match[2].toLowerCase();

  if (unidade === "g" || unidade === "ml") quantidade /= 1000; // converter para kg/l
  return preco / quantidade;
}

async function buscarProdutos(page, termo) {
  const url = `https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Search-Show?q=${encodeURIComponent(termo)}&lang=`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  return await page.evaluate(() => {
    const nomes = Array.from(document.querySelectorAll("span.productCard__title"));
    const precos = Array.from(document.querySelectorAll("span.productPrice__price"));

    return nomes.slice(0, 3).map((el, i) => {
      const nome = el.innerText.trim();
      const precoTxt = precos[i] ? precos[i].innerText.trim() : "0";
      return { nome, precoTxt };
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  const results = [];

  for (const [index, termo] of produtos.entries()) {
    try {
      const encontrados = await buscarProdutos(page, termo);

      const validos = encontrados
        .map(p => ({ nome: p.nome, preco: parsePreco(p.precoTxt) }))
        .filter(p => p.preco > 0);

      if (validos.length > 0) {
        const maisBarato = validos.reduce((a, b) => (a.preco < b.preco ? a : b));
        results.push({
          id: index + 1, // id sequencial, você pode ajustar para usar algum mapeamento do products.txt
          supermercado: "Arena",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: parsePrecoPorKg(maisBarato.nome, maisBarato.preco)
        });
        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      } else {
        results.push({
          id: index + 1,
          supermercado: "Arena",
          produto: termo,
          preco: 0,
          preco_por_kg: 0
        });
        console.log(`⚠️ Nenhum preço válido encontrado para "${termo}"`);
      }
    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
      results.push({
        id: index + 1,
        supermercado: "Arena",
        produto: termo,
        preco: 0,
        preco_por_kg: 0
      });
    }
  }

  await browser.close();

  // Salvar JSON
  if (!fs.existsSync(path.dirname(outputFile))) fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf-8");

  console.log(`💾 Preços da Arena salvos em ${outputFile}`);
})();
