const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ✅ CORREÇÃO DE CAMINHOS: Sobe dois níveis (sai de hortolandia, sai de scrapers) para chegar na raiz
const OUTPUT_FILE = path.resolve(__dirname, "..", "..", "docs", "prices", "prices_savegnago.json");
const INPUT_FILE = path.resolve(__dirname, "..", "..", "products.txt");

function normalizar(txt) {
  if (!txt) return "";
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
  if (!txt) return 0;
  const n = parseFloat(txt.replace("R$", "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function buscarProdutos(page, termo) {
  const url = `https://www.savegnago.com.br/${encodeURIComponent(termo)}?_q=${encodeURIComponent(termo)}`;
  
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    // Seletor específico da VTEX usado pelo Savegnago
    await page.waitForSelector("span.vtex-product-summary-2-x-productBrand", { timeout: 15000 });
    await page.mouse.wheel({ deltaY: 400 });
    await new Promise(r => setTimeout(r, 1500));
  } catch (e) {
    return [];
  }

  return await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("section.vtex-product-summary-2-x-container"));
    return cards.slice(0, 15).map(card => {
      const nome = card.querySelector("span.vtex-product-summary-2-x-productBrand")?.innerText.trim() || "";
      let precoTxt = card.querySelector("p.savegnagoio-store-theme-15-x-priceUnit")?.innerText || 
                     card.querySelector(".vtex-product-price-1-x-sellingPrice")?.innerText || "0";
      return { nome, precoTxt };
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();
  
  // ✅ Adicionado User-Agent para evitar bloqueios do Savegnago
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ products.txt não encontrado em: ${INPUT_FILE}`);
    await browser.close();
    return;
  }

  const produtos = fs.readFileSync(INPUT_FILE, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#")); 

  const results = [];
  let totalEncontrados = 0;

  for (const [index, termo] of produtos.entries()) {
    try {
      let termoParaBusca = termo.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
      console.log(`🔍 [Savegnago] Buscando: ${termoParaBusca}`);
      
      const encontradosProd = await buscarProdutos(page, termoParaBusca);
      const termoNorm = normalizar(termoParaBusca);

      const filtrados = encontradosProd
        .map(p => ({
          nome: p.nome,
          preco: parsePreco(p.precoTxt),
          peso: extrairPeso(p.nome)
        }))
        .filter(p => {
          const nomeNorm = normalizar(p.nome);
          if (!termoNorm.includes('suina') && nomeNorm.includes('suina')) return false;
          
          const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
          return p.preco > 0 && palavrasBusca.every(pal => nomeNorm.includes(pal.substring(0, 3)));
        });

      if (filtrados.length > 0) {
        const maisBarato = filtrados.map(p => ({
          ...p,
          preco_por_kg: +(p.preco / p.peso).toFixed(2)
        })).sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        totalEncontrados++;
        results.push({
          id: index + 1,
          supermercado: "Savegnago",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      }
    } catch (err) {
      console.error(`❌ Erro em ${termo}:`, err.message);
    }
  }

  await browser.close();

  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");

  console.log(`📊 Finalizado Savegnago: ${totalEncontrados}/${produtos.length}`);
})();
                                  
