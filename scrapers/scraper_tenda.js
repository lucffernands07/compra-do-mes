import puppeteer from "puppeteer";
import fs from "fs";

const INPUT_FILE = "products.txt";
const OUTPUT_FILE = "docs/prices/prices_tenda.json";
const BASE_URL = "https://www.tendaatacado.com.br/busca?q=";

function extrairPeso(nome) {
  nome = nome.toLowerCase();

  // Match para "500g", "900 g"
  let match = nome.match(/(\d+)\s*g/);
  if (match) return parseInt(match[1], 10) / 1000; // gramas → kg

  // Match para "1,5kg", "2 kg"
  match = nome.match(/(\d+[.,]?\d*)\s*kg/);
  if (match) return parseFloat(match[1].replace(",", "."));

  // Match para "200ml", "1,5l"
  match = nome.match(/(\d+[.,]?\d*)\s*ml/);
  if (match) return parseFloat(match[1].replace(",", ".")) / 1000;

  match = nome.match(/(\d+[.,]?\d*)\s*l/);
  if (match) return parseFloat(match[1].replace(",", "."));

  return 1; // fallback caso não encontre peso
}

async function buscarProduto(page, produto) {
  const url = `${BASE_URL}${encodeURIComponent(produto)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const items = await page.evaluate(() => {
    const produtos = [];
    document.querySelectorAll("a.showcase-card-content").forEach(a => {
      const nome = a.querySelector("h3")?.innerText.trim();
      const precoText = a.querySelector(".SimplePriceComponent")?.innerText;
      if (nome && precoText) {
        const preco = parseFloat(
          precoText.replace("R$", "").replace(",", ".").replace("un", "").trim()
        );
        if (!isNaN(preco)) {
          produtos.push({ nome, preco });
        }
      }
    });
    return produtos;
  });

  // Pega só os 3 primeiros
  return items.slice(0, 3).map(p => {
    const peso = extrairPeso(p.nome);
    return {
      supermercado: "Tenda",
      produto: p.nome,
      preco: p.preco,
      preco_por_kg: +(p.preco / peso).toFixed(2)
    };
  });
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // Lê lista de produtos
  const produtos = fs
    .readFileSync(INPUT_FILE, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  let resultados = [];

  for (const produto of produtos) {
    try {
      console.log(`🔍 Buscando Tenda: ${produto}`);
      const encontrados = await buscarProduto(page, produto);
      resultados.push(...encontrados);
    } catch (err) {
      console.error(`Erro Tenda (${produto}):`, err.message);
    }
  }

  await browser.close();

  // Salva JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`💾 Resultados salvos em ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error("❌ Erro no scraper:", err);
  process.exit(1);
});
