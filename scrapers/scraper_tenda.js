const puppeteer = require("puppeteer");
const fs = require("fs");

const INPUT_FILE = "products.txt";
const OUTPUT_FILE = "docs/prices/prices_tenda.json";

// 🔎 Normaliza texto: remove acentos e deixa em minúsculo
function normalizar(txt) {
  if (!txt) return "";
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Extrair peso do nome do produto para calcular preço por KG
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
  // A busca no site usa o termo original, mas o filtro usará o normalizado
  const url = `https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(termo)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

  return await page.evaluate(() => {
  return Array.from(document.querySelectorAll("a.showcase-card-content"))
    .slice(0, 12)
    .map(card => {
      const nome = card.querySelector("h3.TitleCardComponent")?.innerText.trim() || "Produto sem nome";
      
      // Captura o texto do preço
      const precoTxt = card.querySelector("div.SimplePriceComponent")?.innerText || "0";
      
      // LIMPEZA MELHORADA:
      // 1. Remove espaços em branco e o caractere especial &nbsp;
      // 2. Remove "R$" e "un"
      // 3. Substitui a vírgula por ponto
      const precoLimpo = precoTxt
        .replace(/\u00a0/g, " ") // Troca &nbsp; por espaço comum
        .replace(/\s/g, "")      // Remove todos os espaços
        .replace("R$", "")
        .replace("un", "")
        .replace(",", ".")
        .replace(/[^\d.]/g, ""); // Garante que fiquem apenas números e ponto

      const preco = parseFloat(precoLimpo) || 0;
      return { nome, preco };
    });
});

  });
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // Configuração inicial de CEP para Hortolândia
  try {
    await page.goto("https://www.tendaatacado.com.br", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#shipping-cep", { timeout: 10000 });
    await page.type("#shipping-cep", "13187166", { delay: 100 });
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 4000));
    console.log("✅ CEP configurado para Hortolândia");
  } catch {
    console.log("⚠️ CEP já configurado ou campo não encontrado.");
  }

  const produtos = fs.readFileSync(INPUT_FILE, "utf-8").split("\n").map(l => l.trim()).filter(Boolean);
  let resultados = [];
  let totalEncontrados = 0;

  for (const [index, termo] of produtos.entries()) {
    const id = index + 1;
    try {
      let termoParaBusca = termo.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").replace(/ bandeja/gi, "").trim();
      console.log(`🔍 Buscando: ${termoParaBusca}`);
      
      const encontrados = await buscarProduto(page, termoParaBusca);
      const termoNorm = normalizar(termoParaBusca);

      const validos = encontrados.filter(p => {
        const nomeProdNorm = normalizar(p.nome);

        // 1. Bloqueios de Categoria (Baseado nas fotos enviadas)
        if (!termoNorm.includes('suina') && nomeProdNorm.includes('suina')) return false; // Evita carne de porco
        if (!termoNorm.includes('oleo') && nomeProdNorm.includes('oleo')) return false; // Evita óleo na busca de algodão
        if (!termoNorm.includes('bom ar') && nomeProdNorm.includes('bom ar')) return false; // Evita aromatizador na busca de algodão

        // 2. Regra de Matches por Radical (Aceita "Bov." ou "Bovina")
        const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
        if (palavrasBusca.length === 0) return nomeProdNorm.includes(termoNorm);

        // Verifica se cada palavra da busca (ou suas 4 primeiras letras) está no nome
        return palavrasBusca.every(pal => nomeProdNorm.includes(pal.substring(0, 4)));
      });

      if (validos.length === 0) {
        console.log(`⚠️ Nenhum match válido para: ${termo}`);
        continue;
      }

      // 3. Seleção por Melhor Preço por KG (Calculado dinamicamente)
      const melhorOpcao = validos.reduce((prev, curr) => {
        const precoKgPrev = prev.preco / extrairPeso(prev.nome);
        const precoKgCurr = curr.preco / extrairPeso(curr.nome);
        return precoKgCurr < precoKgPrev ? curr : prev;
      });

      const pesoFinal = extrairPeso(melhorOpcao.nome);
      resultados.push({
        id,
        supermercado: "Tenda",
        produto: melhorOpcao.nome,
        preco: melhorOpcao.preco,
        preco_por_kg: +(melhorOpcao.preco / pesoFinal).toFixed(2)
      });

      totalEncontrados++;
      console.log(`✅ ${melhorOpcao.nome} - R$ ${melhorOpcao.preco.toFixed(2)} (R$ ${(melhorOpcao.preco / pesoFinal).toFixed(2)}/kg)`);
      
    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
    }
  }

  await browser.close();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`💾 Salvo em ${OUTPUT_FILE}. Total: ${totalEncontrados}/${produtos.length}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
        
