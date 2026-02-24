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
  
  // Captura o padrão "Aprox. 200g" ou similar, comum no Giga para legumes/frutas
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
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-http2"] 
  });
  const page = await browser.newPage();
  
  // User agent moderno para evitar detecção de bot
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  if (!fs.existsSync(produtosTxtPath)) {
    console.error("❌ products.txt não encontrado!");
    await browser.close();
    return;
  }

  const linhasProdutos = fs.readFileSync(produtosTxtPath, "utf-8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

  const resultado = [];

  try {
    for (const [index, nomeOriginal] of linhasProdutos.entries()) {
      const id = index + 1;
      let termoParaBusca = nomeOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
      const termoNorm = normalizar(termoParaBusca);
      const termoEncoded = encodeURIComponent(termoParaBusca);

      console.log(`🔍 [Giga] Buscando: ${termoParaBusca}`);

      try {
        // ✅ URL atualizada com o padrão de busca Full Text (map=ft)
        await page.goto(
          `https://www.giga.com.vc/${termoEncoded}?_q=${termoEncoded}&map=ft`,
          { waitUntil: "networkidle2", timeout: 45000 }
        );

        // Espera o carregamento de um elemento de produto (marca/nome)
        await page.waitForSelector("span[class*='productBrand']", { timeout: 10000 });
        
        // Scroll para garantir que os preços assíncronos carreguem
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise(r => setTimeout(r, 2500)); 
      } catch (e) {
        console.log(`⚠️ Sem resultados ou timeout para: ${termoParaBusca}`);
        continue;
      }

      const items = await page.evaluate(() => {
        const products = [];
        // Seleciona os containers de produto da VTEX
        const cards = document.querySelectorAll("section[class*='vtex-product-summary'], div[class*='vtex-product-summary']");

        cards.forEach(card => {
          const nomeEl = card.querySelector("span[class*='productBrand']");
          if (!nomeEl) return;

          // 1. Tenta pegar o preço por KG direto (comum em hortifruti no Giga)
          const precoKgEl = card.querySelector("[class*='unity-complete']");
          let precoFinal = 0;
          let isPorKgDireto = false;

          // Define qual elemento de preço ler (prioriza o preço por quilo se existir)
          const targetEl = (precoKgEl && precoKgEl.innerText.includes("/kg")) ? precoKgEl : card.querySelector("[class*='sellingPriceValue']");
          
          if (targetEl) {
            // ✅ Captura fragmentada: Inteiro + Fração
            const pInt = targetEl.querySelector("[class*='currencyInteger']")?.innerText || "0";
            const pFrac = targetEl.querySelector("[class*='currencyFraction']")?.innerText || "00";
            
            // Limpa caracteres não numéricos e converte para float
            precoFinal = parseFloat(`${pInt.replace(/\D/g,'')}.${pFrac.replace(/\D/g,'')}`);
            if (targetEl === precoKgEl) isPorKgDireto = true;
          }

          products.push({ 
            nome: nomeEl.innerText.trim(), 
            preco: precoFinal,
            isPorKgDireto,
            textoCompleto: card.innerText // Enviado para ajudar na extração de peso (ex: "Aprox. 200g")
          });
        });
        return products;
      });

      // Processamento dos dados capturados
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
        const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
        // Filtra para garantir que o produto tenha preço e contenha a primeira palavra da busca
        return item.preco > 0 && nomeNorm.includes(palavrasBusca[0]);
      });

      if (filtrados.length > 0) {
        // Ordena pelo menor preço por quilo para ignorar itens como "batata chips" se estiver buscando "batata"
        const melhorOpcao = filtrados.sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        resultado.push({
          id,
          supermercado: "Giga",
          produto: melhorOpcao.nome,
          preco: melhorOpcao.preco,
          preco_por_kg: melhorOpcao.preco_por_kg
        });

        console.log(`✅ ${melhorOpcao.nome} - R$ ${melhorOpcao.preco.toFixed(2)} (R$ ${melhorOpcao.preco_por_kg}/kg)`);
      } else {
        console.log(`❌ Nenhum item válido encontrado para: ${termoParaBusca}`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // Salva o resultado final
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_giga.json"), JSON.stringify(resultado, null, 2), "utf-8");
    console.log(`\n📂 Arquivo prices_giga.json gerado com sucesso em ${outDir}`);

  } catch (err) {
    console.error("❌ Erro Crítico no Scraper Giga:", err.message);
  } finally {
    await browser.close();
  }
}

main();
  
