const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const produtosTxtPath = path.join(__dirname, "..", "..", "products.txt");
const outDir = path.join(__dirname, "..", "..", "docs", "prices");

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
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
    let termoParaBusca = nomeOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
    console.log(`🔍 [Giga] Buscando: ${termoParaBusca}`);

    try {
      // URL de busca robusta para VTEX
      const urlBusca = `https://www.giga.com.vc/${encodeURIComponent(termoParaBusca)}?_q=${encodeURIComponent(termoParaBusca)}&map=ft`;
      
      await page.goto(urlBusca, { waitUntil: "domcontentloaded", timeout: 45000 });

      // ✅ Espera pelo seletor de nome que você enviou na imagem
      await page.waitForSelector("[class*='ProductName']", { timeout: 20000 });
      
      // Scroll para garantir que os elementos de preço carreguem (Lazy Load)
      await page.evaluate(() => window.scrollBy(0, 700));
      await new Promise(r => setTimeout(r, 4000));

      const items = await page.evaluate(() => {
        const products = [];
        // Seleciona o card do produto
        const cards = document.querySelectorAll("section[class*='vtex-product-summary']");

        cards.forEach(card => {
          // ✅ TÍTULO: Usando a hierarquia da sua imagem
          const nomeEl = card.querySelector("[class*='ProductName']");
          
          // ✅ PREÇO: Captura fragmentada conforme sua imagem do console
          const pInt = card.querySelector("[class*='currencyInteger']")?.innerText || "";
          const pFrac = card.querySelector("[class*='currencyFraction']")?.innerText || "";
          
          if (nomeEl && pInt) {
            // Concatena a parte inteira e decimal para formar o float
            const precoFinal = parseFloat(`${pInt.replace(/\D/g,'')}.${pFrac.replace(/\D/g,'')}`);
            
            products.push({ 
              nome: nomeEl.innerText.trim(), 
              preco: precoFinal 
            });
          }
        });
        return products;
      });

      // Filtra para garantir que o resultado tenha relação com o termo buscado
      const primeiraPalavra = termoParaBusca.split(" ")[0].toLowerCase();
      const filtrados = items.filter(item => 
        item.nome.toLowerCase().includes(primeiraPalavra) && item.preco > 0
      );

      if (filtrados.length > 0) {
        // Ordena para pegar o menor preço entre os resultados encontrados
        const melhor = filtrados.sort((a,b) => a.preco - b.preco)[0];
        
        resultado.push({
          id: index + 1,
          supermercado: "Giga",
          produto: melhor.nome,
          preco: melhor.preco,
          preco_por_kg: melhor.preco // Mantido simplificado para garantir o funcionamento
        });
        console.log(`✅ ${melhor.nome} - R$ ${melhor.preco.toFixed(2)}`);
      } else {
        console.log(`❌ Nenhum item encontrado para: ${termoParaBusca}`);
      }

    } catch (e) {
      console.log(`⚠️ Erro em ${termoParaBusca}: Timeout ou estrutura não carregada.`);
    }
    
    // Pequena pausa para não ser bloqueado por excesso de requisições
    await new Promise(r => setTimeout(r, 2000));
  }

  // Gravação do arquivo final no diretório correto para o GitHub Actions
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "prices_giga.json"), JSON.stringify(resultado, null, 2), "utf-8");
  console.log("📂 prices_giga.json gerado com sucesso!");
  
  await browser.close();
}

main();
