const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ✅ CORREÇÃO DE CAMINHO: Sobe dois níveis para achar a raiz
const produtosTxtPath = path.resolve(__dirname, "..", "..", "products.txt");
const outDir = path.resolve(__dirname, "..", "..", "docs", "prices");

function normalizar(txt) {
  if (!txt) return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function extrairPeso(nome) {
  const n = nome.toLowerCase();
  const matchG = n.match(/(\d+)\s*g/);
  if (matchG) return parseInt(matchG[1], 10) / 1000;
  const matchKg = n.match(/(\d+[.,]?\d*)\s*kg/);
  if (matchKg) return parseFloat(matchKg[1].replace(",", "."));
  const matchMl = n.match(/(\d+[.,]?\d*)\s*ml/);
  if (matchMl) return parseFloat(matchMl[1].replace(",", ".")) / 1000;
  const matchL = n.match(/(\d+[.,]?\d*)\s*l/);
  if (matchL) return parseFloat(matchL[1].replace(",", "."));
  return 1;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  if (!fs.existsSync(produtosTxtPath)) {
    console.error(`❌ products.txt não encontrado em: ${produtosTxtPath}`);
    await browser.close();
    return;
  }

  // ✅ CORREÇÃO: Lendo as linhas corretamente
  const linhasProdutos = fs.readFileSync(produtosTxtPath, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#")); 

  const resultado = [];
  let totalEncontrados = 0;

  try {
    for (const [index, produto] of linhasProdutos.entries()) { // ✅ Corrigido de 'produtos' para 'linhasProdutos'
      const id = index + 1;
      let termoParaBusca = produto.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
      const termoNorm = normalizar(termoParaBusca);

      console.log(`🔍 [GoodBom] Buscando: ${termoParaBusca}`);

      try {
        await page.goto(
          `https://www.goodbom.com.br/hortolandia/busca?q=${encodeURIComponent(termoParaBusca)}`,
          { waitUntil: "networkidle2", timeout: 60000 }
        );

        await page.waitForSelector("span.product-name", { timeout: 15000 });
        await page.mouse.wheel({ deltaY: 400 });
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.log(`⚠️ Sem resultados para: ${termoParaBusca}`);
        continue;
      }

      const items = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("span.product-name"));
        return spans.slice(0, 15).map(span => {
          const nome = span.innerText.trim();
          const card = span.closest("a") || span.parentElement;
          let precoTxt = card.querySelector("span.price")?.innerText || 
                         card.querySelector(".sale-price")?.innerText || "0";
          return { nome, precoTxt };
        });
      });

      const filtrados = items.map(item => {
        const pTxt = item.precoTxt.replace("R$", "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
        return {
          nome: item.nome,
          preco: parseFloat(pTxt) || 0,
          peso_kg: extrairPeso(item.nome)
        };
      }).filter(item => {
        const nomeNorm = normalizar(item.nome);
        if (!termoNorm.includes('suina') && nomeNorm.includes('suina')) return false;
        
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
          supermercado: "Goodbom",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      }
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(outDir, "prices_goodbom.json"),
      JSON.stringify(resultado, null, 2),
      "utf-8"
    );

    console.log(`📊 Finalizado GoodBom: ${totalEncontrados}/${linhasProdutos.length}`);
  } catch (err) {
    console.error("❌ Erro fatal GoodBom:", err.message);
  } finally {
    await browser.close();
  }
}

main();
    
