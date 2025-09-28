// scrapers/scraper_savegnago.js
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const OUTPUT_FILE = path.join(__dirname, "..", "docs", "prices", "prices_savegnago.json");
const INPUT_FILE = path.join(__dirname, "..", "products.txt");

// 🔎 Normaliza texto: minúsculo + sem acento
function normalizar(txt) {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Extrair peso/unidade
function extrairPeso(nome) {
  nome = nome.toLowerCase();

  let match = nome.match(/(\d+)\s*g/);
  if (match) return parseInt(match[1], 10) / 1000;

  match = nome.match(/(\d+[.,]?\d*)\s*kg/);
  if (match) return parseFloat(match[1].replace(",", "."));

  match = nome.match(/(\d+[.,]?\d*)\s*ml/);
  if (match) return parseFloat(match[1].replace(",", ".")) / 1000;

  match = nome.match(/(\d+[.,]?\d*)\s*l/);
  if (match) return parseFloat(match[1].replace(",", "."));

  return 1;
}

async function buscarProdutos(page, termo) {
  const url = `https://www.savegnago.com.br/${encodeURIComponent(termo)}?_q=${encodeURIComponent(termo)}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });

  return await page.evaluate(() => {
    const nomes = Array.from(document.querySelectorAll("span.vtex-product-summary-2-x-productBrand"));
    const precos = Array.from(document.querySelectorAll("p.savegnagoio-store-theme-15-x-priceUnit"));

    return nomes.slice(0, 9).map((el, i) => {
      const nome = el.innerText.trim();
      const precoTxt = precos[i] ? precos[i].innerText.trim() : "0";
      return { nome, precoTxt };
    });
  });
}

function parsePreco(txt) {
  return parseFloat(
    txt.replace("R$", "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
  ) || 0;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  const produtos = fs.readFileSync(INPUT_FILE, "utf-8")
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean);

  const results = [];
  let totalEncontrados = 0;

  for (const [index, termo] of produtos.entries()) {
    try {
      console.log(`🔍 Buscando: ${termo}`);
      const encontrados = await buscarProdutos(page, termo);

      const termoNorm = normalizar(termo);
      const validos = encontrados
        .map(p => ({
          nome: p.nome,
          preco: parsePreco(p.precoTxt),
          peso: extrairPeso(p.nome)
        }))
        .filter(p =>
          p.preco > 0 &&
          normalizar(p.nome).includes(termoNorm) // ✅ filtro CONTÉM ignorando acento/maiúsculas
        );

      if (validos.length > 0) {
        validos.forEach(p => {
          p.preco_por_kg = +(p.preco / p.peso).toFixed(2);
        });

        const maisBarato = validos.reduce((a, b) =>
          a.preco_por_kg < b.preco_por_kg ? a : b
        );

        results.push({
          id: index + 1,
          supermercado: "Savegnago",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        totalEncontrados++;
        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      } else {
        results.push({
          id: index + 1,
          supermercado: "Savegnago",
          produto: termo,
          preco: 0,
          preco_por_kg: 0
        });
        console.log(`⚠️ Nenhum preço válido encontrado para "${termo}"`);
      }
    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
    }
  }

  await browser.close();

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log(`💾 Resultados Savegnago salvos em ${OUTPUT_FILE}`);
  console.log(`📊 Total de produtos encontrados: ${totalEncontrados}/${produtos.length}`);
})();
