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

function parsePreco(txt) {
  if (!txt) return 0;
  // Captura o valor numérico ignorando R$ e outros textos
  const match = txt.replace(/\s/g, "").match(/(\d+,\d{2})/);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-http2"] 
  });
  const page = await browser.newPage();
  
  // User agent mais atualizado para evitar bloqueios
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

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

      console.log(`🔍 [Giga] Buscando: ${termoParaBusca}`);

      try {
        // Navegação com timeout estendido
        await page.goto(
          `https://www.giga.com.vc/${encodeURIComponent(termoParaBusca)}`,
          { waitUntil: "networkidle2", timeout: 60000 }
        );

        // Espera por qualquer um dos seletores comuns de nome de produto na VTEX
        await page.waitForSelector("h3, p[class*='productName'], span[class*='name']", { timeout: 10000 });
        
        // Scroll suave para carregar preços assíncronos
        await page.evaluate(() => window.scrollBy(0, 400));
        await new Promise(r => setTimeout(r, 2000)); 
      } catch (e) {
        console.log(`⚠️ Sem resultados visíveis no Giga para: ${termoParaBusca}`);
        continue;
      }

      const items = await page.evaluate(() => {
        const products = [];
        // Seleciona todos os cards de produto (geralmente <article> ou <section> com classes de prateleira)
        const shelfItems = document.querySelectorAll("section[class*='vtex-product-summary'], div[class*='vtex-product-summary']");

        shelfItems.forEach(container => {
          const nomeEl = container.querySelector("h3, p[class*='productName'], span[class*='name']");
          // Busca o container de preço inteiro para evitar pegar apenas a fração
          const precoEl = container.querySelector("span[class*='Price'], span[class*='currencyContainer']");
          
          if (nomeEl && precoEl) {
            products.push({ 
              nome: nomeEl.innerText.trim(), 
              precoTxt: precoEl.innerText.trim() 
            });
          }
        });
        return products;
      });

      const filtrados = items.map(item => ({
        nome: item.nome,
        preco: parsePreco(item.precoTxt),
        peso_kg: extrairPeso(item.nome)
      })).filter(item => {
        const nomeNorm = normalizar(item.nome);
        const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
        // Verifica se ao menos a primeira palavra da busca está no nome (menos restritivo)
        return item.preco > 0 && nomeNorm.includes(palavrasBusca[0]);
      });

      if (filtrados.length > 0) {
        const maisBarato = filtrados.map(item => ({
          ...item,
          preco_por_kg: parseFloat((item.preco / item.peso_kg).toFixed(2))
        })).sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        resultado.push({
          id,
          supermercado: "Giga",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      } else {
        console.log(`❌ Nenhum item válido após filtro para: ${termoParaBusca}`);
      }
      
      // Pequeno intervalo para não ser bloqueado como robô
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_giga.json"), JSON.stringify(resultado, null, 2), "utf-8");

  } catch (err) {
    console.error("❌ Erro Geral no Giga:", err.message);
  } finally {
    await browser.close();
  }
}
main();
                     
