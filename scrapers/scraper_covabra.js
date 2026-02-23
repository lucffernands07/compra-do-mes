const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const produtosTxtPath = path.join(__dirname, "..", "..", "products.txt");
const outDir = path.join(__dirname, "..", "..", "docs", "prices");

// ... (Mesmas funções normalizar, extrairPeso, parsePreco do script acima) ...

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();

  const linhasProdutos = fs.readFileSync(produtosTxtPath, "utf-8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

  const resultado = [];

  try {
    for (const [index, linha] of linhasProdutos.entries()) {
      const id = index + 1;
      const termosParaTentar = linha.split("|").map(t => t.trim());
      let achouAlgumNestaLinha = false;

      for (const termoOriginal of termosParaTentar) {
        if (achouAlgumNestaLinha) break;

        let termoParaBusca = termoOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
        const termoNorm = normalizar(termoParaBusca);

        console.log(`🔍 [Covabra] Buscando: ${termoParaBusca}`);

        try {
          await page.goto(
            `https://www.covabra.com.br/busca?q=${encodeURIComponent(termoParaBusca)}`,
            { waitUntil: "networkidle2", timeout: 60000 }
          );

          await page.waitForSelector(".product-item", { timeout: 15000 });
        } catch (e) { continue; }

        const items = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll(".product-item"));
          return cards.slice(0, 15).map(card => {
            const nome = card.querySelector(".product-name")?.innerText.trim() || "";
            const precoTxt = card.querySelector(".price")?.innerText || "0";
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

          resultado.push({ id, supermercado: "Covabra", produto: maisBarato.nome, preco: maisBarato.preco, preco_por_kg: maisBarato.preco_por_kg });
          console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
          achouAlgumNestaLinha = true;
        }
      }
    }

    fs.writeFileSync(path.join(outDir, "prices_covabra.json"), JSON.stringify(resultado, null, 2), "utf-8");
  } finally {
    await browser.close();
  }
}
main();
        
