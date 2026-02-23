const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const produtosTxtPath = path.join(__dirname, "..", "..", "products.txt");
const outDir = path.join(__dirname, "..", "..", "docs", "prices");

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

// O Covabra já fornece o dado limpo no data-price, mas mantemos o parse por segurança
function parsePreco(txt) {
  if (!txt) return 0;
  const n = parseFloat(txt.toString().replace("R$", "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();
  
  // User-agent para evitar ser barrado pela VTEX
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

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

      console.log(`🔍 [Covabra] Buscando: ${termoParaBusca}`);

      try {
        await page.goto(
          `https://www.covabra.com.br/${encodeURIComponent(termoParaBusca)}?_q=${encodeURIComponent(termoParaBusca)}&map=ft`,
          { waitUntil: "networkidle2", timeout: 45000 }
        );

        // Espera a seção do produto carregar (baseado na tag que você enviou)
        await page.waitForSelector("section[class*='vtex-product-summary']", { timeout: 15000 });
        
        // Scroll para carregar elementos dinâmicos
        await page.mouse.wheel({ deltaY: 800 });
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.log(`⚠️ Não carregou: ${termoParaBusca}`);
        continue;
      }

      const items = await page.evaluate(() => {
        // Selecionamos todos os containers de produto
        const cards = Array.from(document.querySelectorAll("section[class*='vtex-product-summary']"));
        
        return cards.map(card => {
          // Estratégia 1: Tentar pegar da div de dados (data-layer) que você mostrou no final
          const dataEl = card.querySelector("#product-values-datalayer-event");
          if (dataEl) {
            return {
              nome: dataEl.getAttribute("data-name") || "",
              precoTxt: dataEl.getAttribute("data-price") || "0"
            };
          }

          // Estratégia 2: Caso a div acima não exista, pega pelas classes do título e preço
          const nome = card.querySelector(".vtex-product-summary-2-x-brandName")?.innerText.trim() || "";
          const precoEl = card.querySelector(".vtex-product-price-1-x-sellingPriceValue");
          const precoTxt = precoEl ? precoEl.innerText : "0";
          
          return { nome, precoTxt };
        });
      });

      const filtrados = items.map(item => ({
        nome: item.nome,
        preco: parsePreco(item.precoTxt),
        peso_kg: extrairPeso(item.nome)
      })).filter(item => {
        const nomeNorm = normalizar(item.nome);
        const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
        return item.preco > 0 && palavrasBusca.every(pal => nomeNorm.includes(pal.substring(0, 3)));
      });

      if (filtrados.length > 0) {
        const maisBarato = filtrados.map(item => ({
          ...item,
          preco_por_kg: parseFloat((item.preco / item.peso_kg).toFixed(2))
        })).sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        resultado.push({
          id,
          supermercado: "Covabra",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      }
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_covabra.json"), JSON.stringify(resultado, null, 2), "utf-8");

  } catch (err) {
    console.error("❌ Erro fatal no Covabra:", err.message);
  } finally {
    await browser.close();
  }
}

main();
        
