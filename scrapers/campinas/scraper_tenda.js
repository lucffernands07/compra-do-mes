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

  // --- PONTE PARA CAMPINAS ---
  // Antes de começar, acessamos o site e setamos o Cookie ou Localização
  try {
    await page.goto("https://www.tendaatacado.com.br/", { waitUntil: "networkidle2" });
    
    // Inserindo o CEP de Campinas para garantir os preços daquela região
    // CEP Exemplo: 13010-001 (Centro)
    await page.waitForSelector('input[name="zipcode"]', { timeout: 5000 }).catch(() => null);
    await page.type('input[name="zipcode"]', '13010001').catch(() => null);
    await page.keyboard.press('Enter').catch(() => null);
    await new Promise(r => setTimeout(r, 3000)); // Espera a página trocar de loja
  } catch (e) {
    console.log("⚠️ Não foi possível setar o CEP, tentando busca direta.");
  }

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

        console.log(`🔍 [Tenda Campinas] Buscando: ${termoParaBusca}`);

        try {
          await page.goto(
            `https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(termoParaBusca)}`,
            { waitUntil: "networkidle2", timeout: 60000 }
          );

          await page.waitForSelector(".product-card", { timeout: 15000 });
        } catch (e) { continue; }

        const items = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll(".product-card"));
          return cards.slice(0, 15).map(card => {
            const nome = card.querySelector(".product-card__name")?.innerText.trim() || "";
            const precoTxt = card.querySelector(".product-card__price")?.innerText || "0";
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
            supermercado: "Tenda", 
            produto: maisBarato.nome, 
            preco: maisBarato.preco, 
            preco_por_kg: maisBarato.preco_por_kg 
          });
          console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
          achouAlgumNestaLinha = true;
        }
      }
    }

    // Salva como prices_tenda_campinas.json para o compare.js encontrar
    fs.writeFileSync(path.join(outDir, "prices_tenda_campinas.json"), JSON.stringify(resultado, null, 2), "utf-8");
  } finally {
    await browser.close();
  }
}
main();
