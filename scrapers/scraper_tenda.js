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
  const url = `https://www.tendaatacado.com.br/busca?q=${encodeURIComponent(termo)}`;
  
  // 1. Vai para a URL e espera o carregamento básico
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });

  try {
    // 2. ESPERA ESSENCIAL: Aguarda o seletor dos cards aparecerem na página
    // Isso evita que o script tente ler a página enquanto ela ainda está "borrada" ou vazia
    await page.waitForSelector("a.showcase-card-content", { timeout: 15000 });
    
    // 3. Pequeno scroll para garantir que o Lazy Loading do Tenda carregue os preços
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
      
      // Busca preço em múltiplos lugares (Plano A e B)
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

  // Configurações Originais de CEP
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
        const nomeProdNorm = normalizar(p.nome); // Ex: "carne moida bovina congelada chuletao"
        const termoNorm = normalizar(termoParaBusca); // Ex: "carne moida bovina"

        // 1. BLOQUEIOS (Para não pegar carne de porco)
        if (!termoNorm.includes('suina') && nomeProdNorm.includes('suina')) return false;

        // 2. REGRA DE PALAVRAS OBRIGATÓRIAS (Match por Radical)
        // Pegamos as palavras da sua busca: ["carne", "moida", "bovina"]
        const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
        
        // Verificamos se cada uma das suas palavras (ou o início delas) está no nome
        const temMatches = palavrasBusca.every(palavra => {
          // Buscamos apenas pelas primeiras 3 letras (ex: "bov" em vez de "bovina")
          // Isso garante que "Bov.", "Bovina" ou "Bovino" sejam aceitos.
          const radical = palavra.substring(0, 3);
          return nomeProdNorm.includes(radical);
        });

        return p.preco > 0 && temMatches;
      });


      if (validos.length > 0) {
        // Seleção do melhor preço por KG (Original)
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
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  console.log(`📊 Finalizado: ${totalEncontrados}/${produtos.length}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
                                              
