const puppeteer = require("puppeteer");
const fs = require("fs");

// Arquivos de entrada/saída
const INPUT_FILE = "products.txt";
const OUTPUT_FILE = "docs/prices/prices_tenda.json";

// -------------------- Funções auxiliares --------------------

// Extrair peso do nome do produto
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

// Normalizar texto para comparação (remove acentos, espaços extras)
function normalizar(str) {
  return str
    .normalize("NFD")                  // separa acentos
    .replace(/[\u0300-\u036f]/g, "")   // remove acentos
    .replace(/\s+/g, " ")              // colapsa espaços
    .trim()
    .toLowerCase();
}

async function buscarProduto(page, termo) {
  const url = `https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(termo)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a.showcase-card-content"))
      .slice(0, 3)
      .map(card => {
        const nome =
          card.querySelector("h3.TitleCardComponent")?.innerText.trim() ||
          "Produto sem nome";

        const precoTxt =
          card.querySelector("div.SimplePriceComponent")?.innerText || "0";
        const preco = parseFloat(
          precoTxt
            .replace(/\s/g, "")
            .replace("R$", "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "")
        ) || 0;

        return { nome, preco };
      });
  });
}

// -------------------- Principal --------------------
async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // 1️⃣ Abre a página inicial de busca
  await page.goto("https://www.tendaatacado.com.br/busca?q=", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  // 2️⃣ Fecha popup “Agora não” se aparecer
  try {
    await page.waitForSelector("button.btn.btn-transparent", { timeout: 5000 });
    await page.click("button.btn.btn-transparent");
    console.log("✅ Popup fechado");
  } catch {
    console.log("ℹ️ Popup não apareceu");
  }

  // 3️⃣ Clicar em "Informe seu cep" e digitar CEP
  try {
    // botão “Informe seu cep”
    await page.waitForSelector('span:has-text("Informe seu cep")', { timeout: 8000 });
    await page.click('span:has-text("Informe seu cep")');
    console.log("✅ Clique no botão CEP");

    // input do CEP
    await page.waitForSelector("#shipping-cep", { timeout: 8000 });
    await page.type("#shipping-cep", "13187166", { delay: 100 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(6000);
    console.log("✅ CEP configurado");
  } catch (err) {
    console.log("⚠️ Falha ao configurar CEP (talvez já esteja setado):", err.message);
  }

  // 4️⃣ Ler lista de produtos
  const produtos = fs
    .readFileSync(INPUT_FILE, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  let resultados = [];

  for (const [index, termo] of produtos.entries()) {
    const id = index + 1;
    try {
      console.log(`🔍 Buscando: ${termo}`);
      const encontrados = await buscarProduto(page, termo);

      // 🔎 Log para depuração (ver exatamente o que o site retorna)
      encontrados.forEach(p => console.log(">>", JSON.stringify(p.nome)));

      const termoNorm = normalizar(termo);
      const validos = encontrados.filter(p => {
        const nomeNorm = normalizar(p.nome);
        return (
          p.preco > 0 &&
          (nomeNorm.startsWith(termoNorm) || nomeNorm.startsWith(termoNorm + " "))
        );
      });

      if (validos.length === 0) {
        console.log(`⚠️ Nenhum preço válido para ${termo}`);
        continue;
      }

      const maisBarato = validos.reduce((a, b) =>
        a.preco < b.preco ? a : b
      );

      const peso = extrairPeso(maisBarato.nome);
      resultados.push({
        id,
        supermercado: "Tenda",
        produto: maisBarato.nome,
        preco: maisBarato.preco,
        preco_por_kg: +(maisBarato.preco / peso).toFixed(2)
      });

      console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
    }
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`💾 Resultados salvos em ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error("❌ Erro no scraper:", err);
  process.exit(1);
});
