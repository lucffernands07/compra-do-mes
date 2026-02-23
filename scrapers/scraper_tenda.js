const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path"); // 👈 ADICIONADO: Faltava isso para o path.resolve funcionar

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
  const url = `https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(termo)}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });

  try {
    await page.waitForSelector("a.showcase-card-content", { timeout: 15000 });
    await page.mouse.wheel({ deltaY: 500 });
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log(`⚠️ Tempo esgotado esperando cards para: ${termo}`);
    return [];
  }

  return await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("a.showcase-card-content"));
    return cards.slice(0, 20).map(card => {
      const nome = card.querySelector("h3.TitleCardComponent")?.innerText.trim() || "";
      let precoTxt = card.querySelector("div.SimplePriceComponent")?.innerText || 
                     card.querySelector("[class*='Price']")?.innerText || "0";

      const precoLimpo = precoTxt
        .replace(/\u00a0/g, " ") 
        .replace(/\s/g, "")      
        .replace("R$", "")
        .replace("un", "")
        .replace(",", ".")
        .replace(/[^\d.]/g, "");

      return { nome, preco: parseFloat(precoLimpo) || 0 };
    });
  });
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  try {
    await page.goto("https://www.tendaatacado.com.br", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#shipping-cep", { timeout: 10000 });
    await page.type("#shipping-cep", "13187166", { delay: 100 });
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 4000));
    console.log("✅ CEP configurado para Hortolândia");
  } catch {
    console.log("⚠️ CEP já configurado.");
  }

  // ✅ CORREÇÃO AQUI: Lendo e filtrando os produtos
  const produtos = fs.readFileSync(path.resolve(__dirname, "..", "products.txt"), "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#") && !l.startsWith("//")); 
  
  let resultados = [];
  let totalEncontrados = 0;

  // ✅ CORREÇÃO AQUI: Usando a variável 'produtos' definida acima
  for (const [index, termo] of produtos.entries()) {
    const id = index + 1;
    try {
      let termoParaBusca = termo.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").replace(/ bandeja/gi, "").trim();
      console.log(`🔍 Buscando: ${termoParaBusca}`);
      
      const encontrados = await buscarProduto(page, termoParaBusca);
      const termoNorm = normalizar(termoParaBusca);

      const validos = encontrados.filter(p => {
        const nomeProdNorm = normalizar(p.nome);
        if (!termoNorm.includes('suina') && nomeProdNorm.includes('suina')) return false;

        const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
        const temMatches = palavrasBusca.every(palavra => {
          const radical = palavra.substring(0, 3);
          return nomeProdNorm.includes(radical);
        });

        return p.preco > 0 && temMatches;
      });

      if (validos.length > 0) {
        const melhorOpcao = validos.reduce((prev, curr) => {
          const precoKgPrev = prev.preco / extrairPeso(prev.nome);
          const precoKgCurr = curr.preco / extrairPeso(curr.nome);
          return (precoKgCurr < precoKgPrev && precoKgCurr > 0) ? curr : prev;
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
        console.log(`✅ ${melhorOpcao.nome} - R$ ${melhorOpcao.preco.toFixed(2)}`);
      } else {
        console.log(`⚠️ Nenhum match válido para: ${termo}`);
      }
      
    } catch (err) {
      console.error(`❌ Erro ao buscar ${termo}:`, err.message);
    }
  }

  await browser.close();
  
  // Garante que a pasta existe antes de salvar
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`📊 Finalizado: ${totalEncontrados}/${produtos.length}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
