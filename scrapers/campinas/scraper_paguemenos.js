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
  const n = parseFloat(txt.toString().replace("R$", "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();
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

      console.log(`🔍 [Pague Menos] Buscando: ${termoParaBusca}`);

      try {
        // URL de busca padrão do Pague Menos
        await page.goto(
          `https://www.superpaguemenos.com.br/busca?q=${encodeURIComponent(termoParaBusca)}`,
          { waitUntil: "networkidle2", timeout: 45000 }
        );

        // Espera carregar o container do produto baseado na tag que você enviou
        await page.waitForSelector(".item-product", { timeout: 15000 });
        
        await page.mouse.wheel({ deltaY: 600 });
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.log(`⚠️ Nada encontrado para: ${termoParaBusca}`);
        continue;
      }

      const items = await page.evaluate(() => {
        const products = [];
        const cards = document.querySelectorAll(".item-product");

        cards.forEach(card => {
          // Estratégia Principal: Pegar do JSON dentro do formulário (mais preciso)
          const form = card.querySelector("form.product-form");
          if (form && form.getAttribute("data-json")) {
            try {
              const data = JSON.parse(form.getAttribute("data-json"));
              products.push({
                nome: data.item_name || "",
                precoTxt: data.price ? data.price.toString() : "0"
              });
              return;
            } catch (err) {}
          }

          // Estratégia de Backup: Pegar das classes de título e preço
          const nome = card.querySelector(".title")?.innerText.trim() || "";
          const preco = card.querySelector(".sale-price")?.innerText.trim() || "0";
          products.push({ nome, precoTxt: preco });
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
          supermercado: "Pague Menos",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      }
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_paguemenos.json"), JSON.stringify(resultado, null, 2), "utf-8");

  } finally {
    await browser.close();
  }
}

main();
                                        
