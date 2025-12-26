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
  const nomeProdNorm = normalizar(p.nome); // Ex: "carne moida bovina congelada chuletao 1kg"
  const termoNorm = normalizar(termoParaBusca); // Ex: "carne moida bovina"

  // 1. Bloqueio de Categoria (Essencial para não levar Porco por Boi)
  // Se você NÃO buscou por "suina", mas o produto é "suina", ignore.
  if (!termoNorm.includes('suina') && nomeProdNorm.includes('suina')) {
    return false;
  }

  // 2. Flexibilidade de Palavras (Busca por Radical)
  // Divide sua busca em palavras (carne, moida, bovina)
  const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
  
  // Verifica se cada palavra da sua busca está presente no nome do produto.
  // Usamos .substring(0, 3) para aceitar "Bov" se você buscou "Bovina".
  const temMatches = palavrasBusca.every(palavra => 
    nomeProdNorm.includes(palavra.substring(0, 3))
  );

  return p.preco > 0 && temMatches;
});

// 3. Seleção do Melhor Preço por KG (Para escolher entre Chuletão 1kg ou 500g)
if (validos.length > 0) {
  const melhorOpcao = validos.reduce((prev, curr) => {
    // Calcula o preço por KG real para comparar o pacote de 1kg com o de 500g
    const precoKgPrev = prev.precoKg || prev.preco; 
    const precoKgCurr = curr.precoKg || curr.preco;
    return precoKgCurr < precoKgPrev ? curr : prev;
  });
  // Salva o resultado...
}

      


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
