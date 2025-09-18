const puppeteer = require("puppeteer");
const fs = require("fs");

// Arquivos de entrada/saída
const INPUT_FILE = "products.txt";
const OUTPUT_FILE = "docs/prices/prices_tenda.json";

// Função para extrair peso do nome do produto
function extrairPeso(nome) {
  nome = nome.toLowerCase();

  let match = nome.match(/(\d+)\s*g/);
  if (match) return parseInt(match[1], 10) / 1000; // g → kg

  match = nome.match(/(\d+[.,]?\d*)\s*kg/);
  if (match) return parseFloat(match[1].replace(",", ".")); // kg direto

  match = nome.match(/(\d+[.,]?\d*)\s*ml/);
  if (match) return parseFloat(match[1].replace(",", ".")) / 1000; // ml → litro

  match = nome.match(/(\d+[.,]?\d*)\s*l/);
  if (match) return parseFloat(match[1].replace(",", ".")); // litro direto

  return 1; // fallback
}

async function buscarProduto(page, termo) {
  const url = `https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(termo)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a.showcase-card-content")).slice(0, 3).map(card => {
      const nome = card.querySelector("h3.TitleCardComponent")?.innerText.trim() || "Produto sem nome";
      const precoTxt = card.querySelector("div.SimplePriceComponent")?.innerText
        .replace("R$", "")
        .replace("un", "")
        .replace(",", ".")
        .trim() || "0";
      const preco = parseFloat(precoTxt) || 0;
      return { nome, preco };
    });
  });
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // Abrir site e preencher CEP (se necessário)
  await page.goto("https://www.tendaatacado.com.br", { waitUntil: "domcontentloaded", timeout: 60000 });

  try {
    await page.waitForSelector("#shipping-cep", { timeout: 10000 });
    await page.type("#shipping-cep", "13187166", { delay: 100 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(4000);
    console.log("✅ CEP configurado");
  } catch {
    console.log("⚠️ CEP input não encontrado, talvez já esteja configurado.");
  }

  // Ler lista de produtos
  const produtos = fs.readFileSync(INPUT_FILE, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  let resultados = [];

  for (const [index, termo] of produtos.entries()) {
    const id = index + 1; // ID baseado na ordem do products.txt
    try {
      const encontrados = await buscarProduto(page, termo);

      // calcular preço por kg
      encontrados.forEach(p => {
        const peso = extrairPeso(p.nome);
        p.preco_por_kg = +(p.preco / peso).toFixed(2);
      });

      if (encontrados.length > 0) {
        // pega o mais barato
        const maisBarato = encontrados.sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];

        resultados.push({
          id,
          supermercado: "Tenda",
          produto: maisBarato.nome,
          preco: maisBarato.preco,
          preco_por_kg: maisBarato.preco_por_kg
        });

        console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
      } else {
        console.log(`⚠️ Nenhum resultado encontrado para: ${termo}`);
      }

    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
    }
  }

  await browser.close();

  // Salvar JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`💾 Resultados Tenda salvos em ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error("❌ Erro no scraper:", err);
  process.exit(1);
});
