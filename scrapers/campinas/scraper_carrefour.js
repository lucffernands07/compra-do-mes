const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Ajuste de caminhos para a nova estrutura de pastas
const produtosTxtPath = path.join(__dirname, "..", "..", "products.txt");
const outDir = path.join(__dirname, "..", "..", "docs", "prices");

function normalizar(txt) {
  if (!txt) return "";
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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
  const n = parseFloat(
    txt.replace("R$", "")
       .replace(/\s/g, "")
       .replace(",", ".")
       .replace(/[^\d.]/g, "")
  );
  return isNaN(n) ? 0 : n;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();

  // Configura CEP de Campinas para o Carrefour (Ex: Centro)
  await page.setCookie({
    name: 'zipCode',
    value: '13010001',
    domain: '.carrefour.com.br'
  });

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

        console.log(`🔍 [Carrefour] Buscando: ${termoParaBusca}`);

        try {
          await page.goto(
            `https://www.carrefour.com.br/busca/${encodeURIComponent(termoParaBusca)}`,
            { waitUntil: "networkidle2", timeout: 60000 }
          );

          // Espera pelos cards de produto do Carrefour (padrão VTEX)
          await page.waitForSelector("article[class*='vtex-product-summary']", { timeout: 20000 });
          
          // Scroll suave para garantir carregamento dos preços dinâmicos
          await page.mouse.wheel({ deltaY: 500 });
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          console.log(`⚠️ Produto não localizado: ${termoParaBusca}`);
          continue;
        }

        const items = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll("article[class*='vtex-product-summary']"));
          return cards.slice(0, 15).map(card => {
            const nome = card.querySelector("[class*='productBrand']")?.innerText.trim() || "";
            // Captura o preço de venda (sellingPrice)
            const precoTxt = card.querySelector("[class*='sellingPriceValue']")?.innerText || "0";
            return { nome, precoTxt };
          });
        });

        const filtrados = items.map(item => ({
          nome: item.nome,
          preco: parsePreco(item.precoTxt),
          peso_kg: extrairPeso(item.nome)
        })).filter(item => {
          const nomeNorm = normalizar(item.nome);
          
          // Bloqueios de categoria
          if (!termoNorm.includes('suina') && nomeNorm.includes('suina')) return false;
          if (!termoNorm.includes('oleo') && nomeNorm.includes('oleo')) return false;

          const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
          const temTodas = palavrasBusca.every(pal => {
            const radical = pal.substring(0, 3);
            return nomeNorm.includes(radical);
          });

          return item.preco > 0 && temTodas;
        });

        if (filtrados.length > 0) {
          const ordenados = filtrados.map(item => ({
            ...item,
            preco_por_kg: parseFloat((item.preco / item.peso_kg).toFixed(2))
          })).sort((a, b) => a.preco_por_kg - b.preco_por_kg);

          const maisBarato = ordenados[0];
          totalEncontrados++;

          resultado.push({
            id,
            supermercado: "Carrefour",
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
    fs.writeFileSync(
      path.join(outDir, "prices_carrefour.json"),
      JSON.stringify(resultado, null, 2),
      "utf-8"
    );

    console.log(`📊 Finalizado Carrefour: ${totalEncontrados}/${linhasProdutos.length}`);
  } catch (err) {
    console.error("❌ Erro fatal Carrefour:", err.message);
  } finally {
    await browser.close();
  }
}

main();
