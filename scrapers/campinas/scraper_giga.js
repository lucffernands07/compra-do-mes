const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const produtosTxtPath = path.join(__dirname, "..", "..", "products.txt");
const outDir = path.join(__dirname, "..", "..", "docs", "prices");

const PALAVRAS_NEGATIVAS = [
  "pascoa", "kinder", "ferrero", "lacta", "nestle", "garoto", "hershey",
  "salgadinho", "bisnaguinha", "chips", "bolacha", "biscoito", "torcida", 
  "suco", "tempero", "congelado", "pote", "caixa", "mini"
];

function normalizar(txt) {
  if (!txt) return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });
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
    let termosParaTestar = [nomeOriginal];
    if (nomeOriginal.split(" ").length > 1) {
      termosParaTestar.push(nomeOriginal.split(" ")[0]); 
    }

    let encontrado = false;

    for (const termo of termosParaTestar) {
      if (encontrado) break;

      let termoLimpo = termo.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
      console.log(`🔍 [Giga] Buscando: ${termoLimpo}`);

      try {
        const urlBusca = `https://www.giga.com.vc/${encodeURIComponent(termoLimpo)}?_q=${encodeURIComponent(termoLimpo)}&map=ft`;
        
        await page.goto(urlBusca, { waitUntil: "networkidle2", timeout: 45000 });

        // Espera o seletor da VTEX carregar
        await page.waitForSelector("[class*='ProductName']", { timeout: 15000 }).catch(() => null);
        
        // Scroll necessário para disparar o carregamento dos preços (Lazy Load)
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 4000));

        const items = await page.evaluate(() => {
          const products = [];
          // Seleciona todos os cards de produto
          const cards = document.querySelectorAll("section[class*='vtex-product-summary']");

          cards.forEach(card => {
            const nomeEl = card.querySelector("p[class*='ProductName']");
            
            // LÓGICA DE PREÇO: Prioriza o preço por quilo se disponível
            let pInt, pFrac;
            
            const unityKg = card.querySelector("[class*='unity-complete']");
            if (unityKg) {
              // Se achou a div de preço por KG, busca o preço dentro dela
              pInt = unityKg.querySelector("[class*='currencyInteger']")?.innerText || "";
              pFrac = unityKg.querySelector("[class*='currencyFraction']")?.innerText || "";
            } else {
              // Senão busca o preço padrão (venda)
              pInt = card.querySelector("[class*='currencyInteger']")?.innerText || "";
              pFrac = card.querySelector("[class*='currencyFraction']")?.innerText || "";
            }
            
            if (nomeEl && pInt) {
              const precoFinal = parseFloat(`${pInt.replace(/\D/g,'')}.${pFrac.replace(/\D/g,'')}`);
              products.push({ 
                nome: nomeEl.innerText.trim(), 
                preco: precoFinal 
              });
            }
          });
          return products;
        });

        const termoNorm = normalizar(termoLimpo);
        
        const filtrados = items.filter(item => {
          const nomeNorm = normalizar(item.nome);
          const contemTermo = nomeNorm.includes(termoNorm);
          const temNegativa = PALAVRAS_NEGATIVAS.some(neg => nomeNorm.includes(neg));
          
          let precoSuspeito = false;
          if (termoNorm === "ovo" && item.preco > 40) precoSuspeito = true;
          
          return contemTermo && !temNegativa && !precoSuspeito && item.preco > 0;
        });

        if (filtrados.length > 0) {
          // Ordena pelo preço para pegar o item in natura mais barato
          const melhor = filtrados.sort((a,b) => a.preco - b.preco)[0];
          
          resultado.push({
            id: index + 1,
            supermercado: "Giga",
            produto: melhor.nome,
            preco: melhor.preco,
            preco_por_kg: melhor.preco 
          });
          
          console.log(`✅ ${melhor.nome} - R$ ${melhor.preco.toFixed(2)}`);
          encontrado = true;
        }
      } catch (e) {
        console.log(`⚠️ Erro na busca de ${termoLimpo}: ${e.message}`);
        continue;
      }
    }
    
    if (!encontrado) console.log(`❌ Sem resultados válidos para: ${nomeOriginal}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "prices_giga.json"), JSON.stringify(resultado, null, 2), "utf-8");
  console.log(`\n📂 Finalizado! prices_giga.json gerado.`);
  
  await browser.close();
}

main();
