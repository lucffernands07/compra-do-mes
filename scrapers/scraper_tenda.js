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
      // 1. Limpa o termo de busca (remove KG, g, etc) para o motor de busca do site
      let termoParaBusca = termo
        .replace(/\bkg\b/gi, "")
        .replace(/\bg\b/gi, "")
        .replace(/ bandeja/gi, "")
        .trim();
      
      console.log(`🔍 Buscando: ${termoParaBusca}`);
      
      // Aumentamos a busca para olhar até 10 itens (ajuste dentro da função buscarProduto se necessário)
      const encontrados = await buscarProduto(page, termoParaBusca);
      const termoNorm = normalizar(termoParaBusca);
      
      // Criamos uma lista das palavras que VOCÊ quer encontrar (ex: ["carne", "moida"])
      const palavrasBusca = termoNorm.split(" ").filter(p => p.length > 2);

const validos = encontrados.filter(p => {
  const nomeProdNorm = normalizar(p.nome);
  const termoNorm = normalizar(termoParaBusca);
  const preco = p.preco;

  // 1. Lista de ruídos globais (nunca queremos esses itens em buscas genéricas)
  let proibidas = ['refresco', 'tang', 'suco em po', 'gelatina', 'essencia', 'po para'];

  // 2. EXCEÇÕES INTELIGENTES PARA HORTOLÂNDIA (Baseado nas suas imagens)
  
  // Se NÃO estou buscando "Bom Ar", ele vira proibido (resolve o erro do Algodão)
  if (!termoNorm.includes('bom ar')) {
    proibidas.push('bom ar', 'aromatizador', 'difusor', 'click spray', 'refil');
  }

  // Se NÃO estou buscando "Óleo", bloqueia óleos (evita Óleo de Algodão na busca de Algodão)
  if (!termoNorm.includes('oleo')) {
    proibidas.push('oleo de');
  }

  // Se estou buscando Carne BOVINA, proíbe SUÍNA e FRANGO (resolve erro da Carne Moída)
  if (termoNorm.includes('bovina') && (nomeProdNorm.includes('suina') || nomeProdNorm.includes('frango'))) {
    return false;
  }

  // Filtro de segurança: Se o nome do produto no site contém a palavra "suina" 
  // mas você não pediu "suina", descartamos para evitar comparar porco com boi.
  if (!termoNorm.includes('suina') && nomeProdNorm.includes('suina')) {
    return false;
  }

  // 3. Aplicação do filtro de proibidas
  const temProibida = proibidas.some(proc => nomeProdNorm.includes(proc));
  if (temProibida) return false;

  // 4. REGRA DE OURO: Todas as palavras importantes da sua busca devem estar no nome do produto
  // Filtramos palavras curtas como "de", "com", "e" (menores que 3 letras)
  const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
  const temTodasAsPalavras = palavrasBusca.every(palavra => nomeProdNorm.includes(palavra));

  return preco > 0 && temTodasAsPalavras;
});
      


      if (validos.length === 0) {
        console.log(`⚠️ Nenhum preço válido encontrado para ${termo}`);
        continue;
      }

      // 2. Entre os válidos, pegamos o menor preço
      const maisBarato = validos.reduce((a, b) => (a.preco < b.preco ? a : b));

      // 3. Extraímos o peso para calcular o preço por KG (normalização)
      const peso = extrairPeso(maisBarato.nome);
      
      resultados.push({
        id,
        supermercado: "Tenda",
        produto: maisBarato.nome,
        preco: maisBarato.preco,
        preco_por_kg: +(maisBarato.preco / peso).toFixed(2)
      });

      totalEncontrados++;
      console.log(`✅ ${maisBarato.nome} - R$ ${maisBarato.preco.toFixed(2)} (R$ ${(maisBarato.preco / peso).toFixed(2)}/kg)`);
      
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
