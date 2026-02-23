const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ✅ CORREÇÃO: Sobe dois níveis para achar a raiz a partir de scrapers/hortolandia/
const produtosTxtPath = path.resolve(__dirname, "..", "..", "products.txt");
const outDir = path.resolve(__dirname, "..", "..", "docs", "prices");

function normalizar(txt) {
  if (!txt) return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function extrairPeso(nome) {
  const n = nome.toLowerCase();
  const match = n.match(/(\d+[.,]?\d*)\s*(g|kg|ml|l)/);
  if (!match) return 1;
  let qtd = parseFloat(match[1].replace(",", "."));
  const unidade = match[2];
  if (unidade === "g" || unidade === "ml") qtd /= 1000;
  return qtd || 1;
}

function parsePreco(txt) {
  if (!txt) return 0;
  const n = parseFloat(txt.replace("R$", "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();
  
  // User Agent para evitar bloqueios
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  if (!fs.existsSync(produtosTxtPath)) {
    console.error(`❌ products.txt não encontrado em: ${produtosTxtPath}`);
    await browser.close();
    return;
  }

  const linhasProdutos = fs.readFileSync(produtosTxtPath, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#")); 

  const resultado = [];
  let totalEncontrados = 0;

  try {
    for (const [index, linha] of linhasProdutos.entries()) {
      const id = index + 1;
      const termosParaTentar = linha.split("|").map(t => t.trim());
      let achouAlgumNestaLinha = false;

      for (const termoOriginal of termosParaTentar) {
        if (achouAlgumNestaLinha) break;

        let termoParaBusca = termoOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
        const termoNorm = normalizar(termoParaBusca);

        console.log(`🔍 [Arena] Buscando: ${termoParaBusca}`);

        try {
          await page.goto(
            `https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Search-Show?q=${encodeURIComponent(termoParaBusca)}`,
            { waitUntil: "networkidle2", timeout: 60000 }
          );

          await page.waitForSelector("span.productCard__title", { timeout: 15000 });
          await page.mouse.wheel({ deltaY: 400 });
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          continue; 
        }

        const items = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll(".productCard"));
          return cards.slice(0, 15).map(card => {
            const nome = card.querySelector("span.productCard__title")?.innerText.trim() || "";
            let precoTxt = card.querySelector("span.productPrice__price")?.innerText || 
                           card.querySelector(".price")?.innerText || "0";
            return { nome, precoTxt };
          });
        });

        const filtrados = items.map(item => ({
          nome: item.nome,
          preco: parsePreco(item.precoTxt),
          peso_kg: extrairPeso(item.nome)
        })).filter(item => {
          const nomeNorm = normalizar(item.nome);
          if (!termoNorm.includes('suina') && nomeNorm.includes('suina')) return false;
          if (!termoNorm.includes('oleo') && nomeNorm.includes('oleo')) return false;

          const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
          return item.preco > 0 && palavrasBusca.every(pal => nomeNorm.includes(pal.substring(0, 3)));
        });

        if (filtrados.length > 0) {
          const maisBarato = filtrados.map(item => ({
            ...item,
            preco_por_kg: parseFloat((item.preco / item.peso_kg).toFixed(2))
          })).sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

          totalEncontrados++;
          resultado.push({
            id,
            supermercado: "Arena",
            produto: maisBarato.nome,
            preco: maisBarato.preco,
            preco_por_kg: maisBarato.preco_por_kg
          });

          console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
          achouAlgumNestaLinha = true;
        }
      }
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    // ✅ Caminho de salvamento organizado
    fs.writeFileSync(
      path.join(outDir, "prices_arena.json"),
      JSON.stringify(resultado, null, 2),
      "utf-8"
    );

    console.log(`📊 Finalizado Arena: ${totalEncontrados}/${linhasProdutos.length}`);
  } catch (err) {
    console.error("❌ Erro fatal Arena:", err.message);
  } finally {
    await browser.close();
  }
}

main();
            
