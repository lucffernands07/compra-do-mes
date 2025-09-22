// scrapers/scraper_goodbom.js
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

// Normalizar texto: remover acentos, espaços extras e lowercase
function normalizar(txt) {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Função para extrair peso em kg do nome do produto
function extrairPeso(nome) {
  const matchG = nome.toLowerCase().match(/(\d+)\s*g/);
  if (matchG) return parseInt(matchG[1], 10) / 1000;

  const matchKg = nome.toLowerCase().match(/(\d+[.,]?\d*)\s*kg/);
  if (matchKg) return parseFloat(matchKg[1].replace(",", "."));

  const matchMl = nome.toLowerCase().match(/(\d+[.,]?\d*)\s*ml/);
  if (matchMl) return parseFloat(matchMl[1].replace(",", ".")) / 1000;

  const matchL = nome.toLowerCase().match(/(\d+[.,]?\d*)\s*l/);
  if (matchL) return parseFloat(matchL[1].replace(",", "."));

  return 1; // fallback
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const resultado = [];
  let encontrados = 0; // contador de produtos com preço válido

  try {
    for (const [index, produto] of produtos.entries()) {
      const id = index + 1;
      const termoNorm = normalizar(produto);

      await page.goto(
        `https://www.goodbom.com.br/hortolandia/busca?q=${encodeURIComponent(produto)}`,
        { waitUntil: "networkidle2", timeout: 60000 }
      );

      const items = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("span.product-name"));
        return spans.slice(0, 5).map(span => {
          const nome = span.innerText.trim();
          const precoSpan = span.closest("a")?.querySelector("span.price");
          const precoTxt = precoSpan
            ? precoSpan.innerText.replace("R$", "").replace(",", ".").trim()
            : "0";
          const preco = parseFloat(precoTxt) || 0;
          return { nome, preco };
        });
      });

      // 🔎 Filtrar produtos cujo nome contenha o termo (ignora acento e maiúsculas/minúsculas)
      const filtrados = items.filter(item => {
        const nomeNorm = normalizar(item.nome);
        return nomeNorm.includes(termoNorm);
      });

      // Calcular preco_por_kg
      filtrados.forEach(item => {
        const peso_kg = extrairPeso(item.nome);
        item.preco_por_kg = parseFloat((item.preco / peso_kg).toFixed(2));
      });

      if (filtrados.length > 0) {
        const maisBarato = filtrados.sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        if (maisBarato.preco > 0) encontrados++; // ✅ incrementa contador

        resultado.push({
          id,
          supermercado: "Goodbom",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      } else {
        resultado.push({
          id,
          supermercado: "Goodbom",
          produto,
          preco: 0,
          preco_por_kg: 0
        });
        console.log(`⚠️ Nenhum resultado válido para: ${produto}`);
      }
    }

    // Salvar JSON
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "prices_goodbom.json"),
      JSON.stringify(resultado, null, 2),
      "utf-8"
    );

    console.log("💾 Preços GoodBom salvos com sucesso!");
    console.log(`📊 Total de produtos com preço válido: ${encontrados}/${produtos.length}`);
  } catch (err) {
    console.error("❌ Erro no scraper GoodBom:", err.message);
  } finally {
    await browser.close();
  }
}

main();
