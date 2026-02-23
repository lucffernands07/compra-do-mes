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
  const n = parseFloat(txt.replace("R$", "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();

  // User-agent para evitar bloqueios
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const linhasProdutos = fs.readFileSync(produtosTxtPath, "utf-8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

  const resultado = [];

  try {
    for (const [index, nomeOriginal] of linhasProdutos.entries()) {
      const id = index + 1;
      let termoParaBusca = nomeOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
      const termoNorm = normalizar(termoParaBusca);

      console.log(`🔍 [Carrefour] Buscando: ${termoParaBusca}`);

      try {
        await page.goto(
          `https://mercado.carrefour.com.br/busca/${encodeURIComponent(termoParaBusca)}`,
          { waitUntil: "networkidle2", timeout: 60000 }
        );

        // Aguarda o título que você me enviou aparecer
        await page.waitForSelector("h2.text-zinc-medium", { timeout: 15000 });
        
        // Scroll rápido para garantir renderização dos preços
        await page.mouse.wheel({ deltaY: 700 });
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.log(`⚠️ Produto não carregou: ${termoParaBusca}`);
        continue;
      }

      const items = await page.evaluate(() => {
        // Buscamos o container de cada produto (geralmente uma div que envolve o h2 e o span de preço)
        const products = [];
        const titles = document.querySelectorAll("h2.text-zinc-medium");

        titles.forEach(title => {
          // Subimos até um container comum que tenha tanto o nome quanto o preço
          const container = title.closest("div[role='group']") || title.parentElement.parentElement;
          if (container) {
            const nome = title.innerText.trim();
            // Busca o span com a classe de preço que você me enviou
            const precoTxt = container.querySelector("span.text-price-default")?.innerText || "0";
            products.push({ nome, precoTxt });
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
        return item.preco > 0 && palavrasBusca.every(pal => nomeNorm.includes(pal.substring(0, 3)));
      });

      if (filtrados.length > 0) {
        const maisBarato = filtrados.map(item => ({
          ...item,
          preco_por_kg: parseFloat((item.preco / item.peso_kg).toFixed(2))
        })).sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        resultado.push({
          id,
          supermercado: "Carrefour",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      }
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_carrefour.json"), JSON.stringify(resultado, null, 2), "utf-8");
    console.log(`\n✨ Sucesso! ${resultado.length} produtos salvos.`);

  } finally {
    await browser.close();
  }
}

main();
                     
