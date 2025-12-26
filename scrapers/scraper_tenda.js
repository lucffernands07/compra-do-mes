const puppeteer = require("puppeteer");
const fs = require("fs");

const INPUT_FILE = "products.txt";
const OUTPUT_FILE = "docs/prices/prices_tenda.json";

// 🔎 Normaliza texto para minúsculo e sem acento
function normalizar(txt) {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Extrair peso do nome do produto
function extrairPeso(nome) {
  nome = nome.toLowerCase();

  let match = nome.match(/(\d+)\s*g/);
  if (match) return parseInt(match[1], 10) / 1000;

  match = nome.match(/(\d+[.,]?\d*)\s*kg/);
  if (match) return parseFloat(match[1].replace(",", "."));

  match = nome.match(/(\d+[.,]?\d*)\s*ml/);
  if (match) return parseFloat(match[1].replace(",", ".")) / 1000;

  match = nome.match(/(\d+[.,]?\d*)\s*l/);
  if (match) return parseFloat(match[1].replace(",", "."));

  return 1;
}

async function buscarProduto(page, termo) {
  const url = `https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(termo)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a.showcase-card-content"))
      .slice(0, 9) // pode aumentar para 5 se quiser menos resultados
      .map(card => {
        const nome =
          card.querySelector("h3.TitleCardComponent")?.innerText.trim() ||
          "Produto sem nome";

        const precoTxt = card.querySelector("div.SimplePriceComponent")?.innerText || "0";
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

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // Abrir site e preencher CEP (se necessário)
  await page.goto("https://www.tendaatacado.com.br", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  try {
    await page.waitForSelector("#shipping-cep", { timeout: 10000 });
    await page.type("#shipping-cep", "13187166", { delay: 100 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(4000);
    console.log("✅ CEP configurado");
  } catch {
    console.log("⚠️ CEP input não encontrado, talvez já esteja configurado.");
  }

  const produtos = fs
    .readFileSync(INPUT_FILE, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  let resultados = [];
  let totalEncontrados = 0;

    for (const [index, termo] of produtos.entries()) {
    const id = index + 1;
    try {
      // --- AJUSTE AQUI: Limpa o termo antes de mandar pro site ---
      let termoParaBusca = termo.replace(/ kg/gi, "").replace(/ bandeja/gi, "").trim(); 
      console.log(`🔍 Buscando: ${termoParaBusca}`);
      
      const encontrados = await buscarProduto(page, termoParaBusca);
      const termoNorm = normalizar(termoParaBusca);
      
      // --- MELHORIA NO FILTRO: Não exige a frase exata, apenas que as palavras batam ---
      const palavrasChave = termoNorm.split(" ").filter(p => p.length > 2);

      const validos = encontrados.filter(p => {
        const nomeProdNorm = normalizar(p.nome);
        // Verifica se o preço é real e se pelo menos uma palavra da sua busca está no nome
        const temPalavra = palavrasChave.some(palavra => nomeProdNorm.includes(palavra));
        
        // Evita falsos positivos (Ex: busca Mamão e vem Suco de Mamão)
        const palavrasProibidas = ['refresco', 'suco em po', 'gelatina', 'oleo de'];
        const temProibida = palavrasProibidas.some(proibida => nomeProdNorm.includes(proibida));

        return p.preco > 0 && temPalavra && !temProibida;
      });

      if (validos.length === 0) {
        console.log(`⚠️ Nenhum preço válido encontrado para ${termo}`);
        continue;
      }

      // Ordena para pegar o menor preço dos resultados válidos
      const maisBarato = validos.reduce((a, b) => (a.preco < b.preco ? a : b));

      const peso = extrairPeso(maisBarato.nome);
      resultados.push({
        id,
        supermercado: "Tenda",
        produto: maisBarato.nome,
        preco: maisBarato.preco,
        preco_por_kg: +(maisBarato.preco / peso).toFixed(2)
      });

      totalEncontrados++;
      console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)}`);
    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
    }
  }


  await browser.close();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`💾 Resultados salvos em ${OUTPUT_FILE}`);
  console.log(`📊 Total de produtos encontrados: ${totalEncontrados}/${produtos.length}`);
}

main().catch(err => {
  console.error("❌ Erro no scraper:", err);
  process.exit(1);
});
