// scrapers/scraper_arena.js
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Caminhos
const produtosTxtPath = path.join(__dirname, "..", "products.txt");
const outDir = path.join(__dirname, "..", "docs", "prices");

// Lê lista de produtos
const produtos = fs.readFileSync(produtosTxtPath, "utf-8")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

// Normaliza texto: remove acentos, espaços extras e lowercase
function normalizar(txt) {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Extrai peso em kg/l do nome do produto
function extrairPeso(nome) {
  const match = nome.toLowerCase().match(/(\d+)\s*(g|kg|ml|l)/);
  if (!match) return 1;
  let qtd = parseFloat(match[1]);
  const unidade = match[2];
  if (unidade === "g" || unidade === "ml") qtd /= 1000;
  return qtd || 1;
}

// Converte texto de preço para número
function parsePreco(txt) {
  if (!txt) return 0;
  return (
    parseFloat(
      txt.replace("R$", "")
         .replace(",", ".")
         .replace(/[^\d.]/g, "")
    ) || 0
  );
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const resultado = [];
  let encontrados = 0; // contador de produtos com preço válido

  try {
    for (const [index, produto] of produtos.entries()) {
      const id = index + 1;
      const termoNorm = normalizar(produto);

      await page.goto(
        `https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Search-Show?q=${encodeURIComponent(produto)}`,
        { waitUntil: "networkidle2", timeout: 90000 }
      );

      const items = await page.evaluate(() => {
        const nomes = Array.from(document.querySelectorAll("span.productCard__title"));
        const precos = Array.from(document.querySelectorAll("span.productPrice__price"));

        return nomes.slice(0, 9).map((el, i) => {
          const nome = el.innerText.trim();
          const precoTxt = precos[i] ? precos[i].innerText.trim() : "0";
          return { nome, precoTxt };
        });
      });

      // Filtrar produtos cujo nome contenha o termo (ignora acento/maiúsculas)
      const validos = items
        .map(it => {
          const nomeNorm = normalizar(it.nome);
          const preco = parsePreco(it.precoTxt);
          const peso = extrairPeso(it.nome);
          return {
            nome: it.nome,
            preco,
            preco_por_kg: parseFloat((preco / peso).toFixed(2)),
            nomeNorm
          };
        })
        .filter(it => it.preco > 0 && it.nomeNorm.includes(termoNorm));

      if (validos.length > 0) {
        const maisBarato = validos.sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];
        encontrados++;

        resultado.push({
          id,
          supermercado: "Arena",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      } else {
        console.log(`⚠️ Nenhum resultado válido para: ${produto}`);
      }
    }

    // Salvar JSON
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "prices_arena.json"),
      JSON.stringify(resultado, null, 2),
      "utf-8"
    );

    console.log("💾 Preços Arena salvos com sucesso!");
    console.log(`📊 Total de produtos com preço válido: ${encontrados}/${produtos.length}`);
  } catch (err) {
    console.error("❌ Erro no scraper Arena:", err.message);
  } finally {
    await browser.close();
  }
}

main();
