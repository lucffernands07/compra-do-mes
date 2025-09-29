const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const OUTPUT_FILE = path.join(__dirname, "..", "docs", "prices", "prices_savegnago.json");
const INPUT_FILE = path.join(__dirname, "..", "products.txt");

function normalizar(txt) {
  return txt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function extrairPeso(nome) {
  nome = nome.toLowerCase();
  let m = nome.match(/(\d+)\s*g/);
  if (m) return parseInt(m[1], 10) / 1000;
  m = nome.match(/(\d+[.,]?\d*)\s*kg/);
  if (m) return parseFloat(m[1].replace(",", "."));
  m = nome.match(/(\d+[.,]?\d*)\s*ml/);
  if (m) return parseFloat(m[1].replace(",", ".")) / 1000;
  m = nome.match(/(\d+[.,]?\d*)\s*l/);
  if (m) return parseFloat(m[1].replace(",", "."));
  return 1;
}

function parsePreco(txt) {
  const n = parseFloat(txt.replace("R$", "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function buscarProdutos(page, termo) {
  const url = `https://www.savegnago.com.br/${encodeURIComponent(termo)}?_q=${encodeURIComponent(termo)}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  return await page.evaluate(() => {
    const nomes = Array.from(document.querySelectorAll("span.vtex-product-summary-2-x-productBrand"));
    const precos = Array.from(document.querySelectorAll("p.savegnagoio-store-theme-15-x-priceUnit"));
    return nomes.slice(0, 9).map((el, i) => ({
      nome: el.innerText.trim(),
      precoTxt: precos[i] ? precos[i].innerText.trim() : "0"
    }));
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const produtos = fs.readFileSync(INPUT_FILE, "utf-8")
    .split("\n").map(p => p.trim()).filter(Boolean);

  const results = [];
  let encontrados = 0; // ✅ apenas produtos com preço válido

  for (const [index, termo] of produtos.entries()) {
    try {
      console.log(`🔍 Buscando: ${termo}`);
      const encontradosProd = await buscarProdutos(page, termo);
      const termoNorm = normalizar(termo);

      const filtrados = encontradosProd
        .map(p => ({
          nome: p.nome,
          preco: parsePreco(p.precoTxt),
          peso: extrairPeso(p.nome)
        }))
        .filter(p => p.preco > 0 && normalizar(p.nome).includes(termoNorm));

      if (filtrados.length > 0) {
        filtrados.forEach(p => p.preco_por_kg = +(p.preco / p.peso).toFixed(2));
        const maisBarato = filtrados.sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        encontrados++; // ✅ só incrementa se preço > 0

        results.push({
          id: index + 1,
          supermercado: "Savegnago",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      } else {
        console.log(`⚠️ Nenhum resultado válido para: ${termo}`);
      }
    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
    }
  }

  await browser.close();

  // ✅ Salvar apenas produtos com preço válido
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");

  console.log(`💾 Resultados salvos em ${OUTPUT_FILE}`);
  console.log(`📊 Total de produtos com preço válido: ${encontrados}/${produtos.length}`);
})();
