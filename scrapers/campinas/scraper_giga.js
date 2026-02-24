const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const produtosTxtPath = path.join(__dirname, "..", "..", "products.txt");
const outDir = path.join(__dirname, "..", "..", "docs", "prices");

function normalizar(txt) {
  if (!txt) return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function extrairPeso(nome, textoCard = "") {
  const n = (nome + " " + textoCard).toLowerCase();
  const matchAprox = n.match(/aprox\.\s*(\d+)\s*(g|kg)/);
  if (matchAprox) {
    let valor = parseFloat(matchAprox[1]);
    return matchAprox[2] === "g" ? valor / 1000 : valor;
  }
  const match = n.match(/(\d+[.,]?\d*)\s*(g|kg|ml|l)/);
  if (!match) return 1;
  let qtd = parseFloat(match[1].replace(",", "."));
  const unidade = match[2];
  if (unidade === "g" || unidade === "ml") qtd /= 1000;
  return qtd || 1;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox", 
      "--window-size=1920,1080",
      "--disable-features=IsolateOrigins,site-per-process"
    ] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  if (!fs.existsSync(produtosTxtPath)) {
    console.error("❌ products.txt não encontrado!");
    await browser.close();
    return;
  }

  const linhasProdutos = fs.readFileSync(produtosTxtPath, "utf-8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

  const resultado = [];

  for (const [index, nomeOriginal] of linhasProdutos.entries()) {
    let termoParaBusca = nomeOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
    const termoEncoded = encodeURIComponent(termoParaBusca);

    console.log(`🔍 [Giga] Buscando: ${termoParaBusca}`);

    try {
      // Usamos domcontentloaded para ser mais rápido e menos propenso a travar
      await page.goto(
        `https://www.giga.com.vc/${termoEncoded}?_q=${termoEncoded}&map=ft`,
        { waitUntil: "domcontentloaded", timeout: 40000 }
      );

      // Aguarda o seletor principal ou um sinal de "vazio"
      await Promise.race([
        page.waitForSelector("span[class*='productBrand']", { timeout: 15000 }),
        page.waitForSelector(".vtex-search-result-3-x-searchNotFound", { timeout: 15000 }).catch(() => null)
      ]);

      // Scroll para triggar o lazy load da VTEX
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(r => setTimeout(r, 3000)); 

      const items = await page.evaluate(() => {
        const products = [];
        const cards = document.querySelectorAll("section[class*='vtex-product-summary']");

        cards.forEach(card => {
          const nomeEl = card.querySelector("span[class*='productBrand']");
          if (!nomeEl) return;

          const precoKgEl = card.querySelector("[class*='unity-complete']");
          let precoFinal = 0;
          let isPorKgDireto = false;

          const targetEl = (precoKgEl && precoKgEl.innerText.includes("/kg")) ? precoKgEl : card.querySelector("[class*='sellingPriceValue']");
          
          if (targetEl) {
            const pInt = targetEl.querySelector("[class*='currencyInteger']")?.innerText || "0";
            const pFrac = targetEl.querySelector("[class*='currencyFraction']")?.innerText || "00";
            precoFinal = parseFloat(`${pInt.replace(/\D/g,'')}.${pFrac.replace(/\D/g,'')}`);
            if (targetEl === precoKgEl) isPorKgDireto = true;
          }

          products.push({ 
            nome: nomeEl.innerText.trim(), 
            preco: precoFinal,
            isPorKgDireto,
            textoCompleto: card.innerText 
          });
        });
        return products;
      });

      const termoNorm = normalizar(termoParaBusca);
      const filtrados = items.map(item => {
        const peso = item.isPorKgDireto ? 1 : extrairPeso(item.nome, item.textoCompleto);
        return {
          nome: item.nome,
          preco: item.preco,
          peso_kg: peso,
          preco_por_kg: parseFloat((item.preco / peso).toFixed(2))
        };
      }).filter(item => {
        const nomeNorm = normalizar(item.nome);
        const primeiraPalavra = termoNorm.split(" ")[0];
        return item.preco > 0 && nomeNorm.includes(primeiraPalavra);
      });

      if (filtrados.length > 0) {
        const melhorOpcao = filtrados.sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];
        resultado.push({
          id: index + 1,
          supermercado: "Giga",
          produto: melhorOpcao.nome,
          preco: melhorOpcao.preco,
          preco_por_kg: melhorOpcao.preco_por_kg
        });
        console.log(`✅ ${melhorOpcao.nome} - R$ ${melhorOpcao.preco.toFixed(2)}`);
      } else {
        console.log(`❌ Sem itens válidos para: ${termoParaBusca}`);
      }

    } catch (e) {
      console.log(`⚠️ Erro na busca de ${termoParaBusca}: ${e.message}`);
      // Em caso de erro, tenta recarregar a página ou prosseguir para o próximo
      continue;
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "prices_giga.json"), JSON.stringify(resultado, null, 2), "utf-8");
  await browser.close();
}

main();
                                                    
