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
  // Captura unidades comuns: 1kg, 500g, 12un, c/20, 1l
  const match = n.match(/(\d+[.,]?\d*)\s*(g|kg|ml|l|un|c\/|unidades)/);
  if (!match) return 1;
  let qtd = parseFloat(match[1].replace(",", "."));
  const unidade = match[2];
  if (unidade === "g" || unidade === "ml") qtd /= 1000;
  // Se for bandeja (ex: C/20 ovos), tratamos como 1 unidade de compra para o ranking
  return qtd || 1;
}

function parsePreco(txt) {
  if (!txt) return 0;
  // Limpeza profunda para o formato "R$ 13,99"
  const n = parseFloat(txt.replace("R$", "").replace(/\s/g, "").replace(".", "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

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

  try {
    for (const [index, nomeOriginal] of linhasProdutos.entries()) {
      const id = index + 1;
      let termoParaBusca = nomeOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
      const termoNorm = normalizar(termoParaBusca);

      console.log(`🔍 [Enxuto] Buscando: ${termoParaBusca}`);

      try {
        await page.goto(
          `https://www.enxuto.com/busca?termo=${encodeURIComponent(termoParaBusca)}`,
          { waitUntil: "networkidle2", timeout: 40000 }
        );

        // Espera o container principal da busca aparecer
        await page.waitForSelector("[data-cy='produto-descricao']", { timeout: 10000 }).catch(() => null);
        
        // Scroll para carregar a vitrine dinâmica do Enxuto
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise(r => setTimeout(r, 2000));

        const items = await page.evaluate(() => {
          // O Enxuto usa componentes Angular. Buscamos o pai mais próximo de cada produto.
          const products = [];
          const labels = document.querySelectorAll("[data-cy='produto-descricao']");

          labels.forEach(label => {
            // Sobe no DOM para achar o container do card que contém o preço
            const card = label.closest("app-vip-card-produto") || label.parentElement.parentElement;
            const precoEl = card.querySelector("[data-cy='preco']");
            
            if (label && precoEl) {
              products.push({
                nome: label.innerText.trim(),
                precoTxt: precoEl.innerText.trim()
              });
            }
          });
          return products;
        });

        // FILTRO DE QUALIDADE (Evita o Algodão Doce e Ração)
        const filtrados = items.map(item => ({
          nome: item.nome,
          preco: parsePreco(item.precoTxt),
          peso_kg: extrairPeso(item.nome)
        })).filter(item => {
          const nomeNorm = normalizar(item.nome);
          const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
          
          // Critério: O nome deve conter TODAS as palavras da busca (mínimo 3 letras cada)
          return item.preco > 1 && palavrasBusca.every(pal => nomeNorm.includes(pal));
        });

        if (filtrados.length > 0) {
          const melhor = filtrados.sort((a, b) => (a.preco / a.peso_kg) - (b.preco / b.peso_kg))[0];

          resultado.push({
            id,
            supermercado: "Enxuto",
            produto: melhor.nome,
            preco: melhor.preco,
            preco_por_kg: parseFloat((melhor.preco / melhor.peso_kg).toFixed(2))
          });

          console.log(`✅ ${melhor.nome} - R$ ${melhor.preco.toFixed(2)}`);
        } else {
          console.log(`❌ Nada relevante para: ${termoParaBusca}`);
        }
      } catch (e) {
        console.log(`⚠️ Erro na busca: ${termoParaBusca}`);
      }
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_enxuto.json"), JSON.stringify(resultado, null, 2), "utf-8");
    console.log(`\n📂 Finalizado Enxuto com ${resultado.length} produtos.`);

  } finally {
    await browser.close();
  }
}

main();
                                                                             
