const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ✅ Caminhos ajustados para a pasta de Campinas
const PRODUTOS_TXT = path.resolve(__dirname, "../../products.txt");
const OUTPUT_FILE = path.resolve(__dirname, "../../docs/prices/prices_tenda_campinas.json");

function normalizar(txt) {
  if (!txt) return "";
  return txt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("a.showcase-card-content", { timeout: 15000 });
    await page.mouse.wheel({ deltaY: 500 });
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    return [];
  }

  return await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("a.showcase-card-content"));
    return cards.slice(0, 15).map(card => {
      const nome = card.querySelector("h3.TitleCardComponent")?.innerText.trim() || "";
      let precoTxt = card.querySelector("div.SimplePriceComponent")?.innerText || 
                     card.querySelector("[class*='Price']")?.innerText || "0";

      const precoLimpo = precoTxt
        .replace(/\u00a0/g, " ") 
        .replace(/\s/g, "")      
        .replace("R$", "")
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
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log("📍 Configurando CEP para Campinas...");
    await page.goto("https://www.tendaatacado.com.br", { waitUntil: "networkidle2", timeout: 60000 });
    
    // Tenta clicar no botão de CEP se o input não estiver visível
    const cepInput = await page.waitForSelector("#shipping-cep", { timeout: 10000 });
    await cepInput.click({ clickCount: 3 }); // Seleciona tudo se já houver algo
    await page.type("#shipping-cep", "13010001", { delay: 100 }); // ✅ CEP CAMPINAS
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 5000));
    console.log("✅ CEP 13010-001 (Campinas) configurado.");
  } catch (err) {
    console.log("⚠️ CEP já estava configurado ou erro na transição.");
  }

  if (!fs.existsSync(PRODUTOS_TXT)) {
    console.error("❌ products.txt não encontrado!");
    await browser.close();
    return;
  }

  const produtos = fs.readFileSync(PRODUTOS_TXT, "utf-8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  
  let resultados = [];

  for (const [index, termo] of produtos.entries()) {
    const id = index + 1;
    let termoParaBusca = termo.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
    console.log(`🔍 [Tenda Campinas] Buscando: ${termoParaBusca}`);
    
    const encontrados = await buscarProduto(page, termoParaBusca);
    const termoNorm = normalizar(termoParaBusca);

    const validos = encontrados.filter(p => {
      const nomeProdNorm = normalizar(p.nome);
      const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
      return p.preco > 0 && palavrasBusca.every(pal => nomeProdNorm.includes(pal.substring(0, 3)));
    });

    if (validos.length > 0) {
      const melhorOpcao = validos.reduce((prev, curr) => {
        const precoKgPrev = prev.preco / extrairPeso(prev.nome);
        const precoKgCurr = curr.preco / extrairPeso(curr.nome);
        return (precoKgCurr < precoKgPrev) ? curr : prev;
      });

      resultados.push({
        id,
        supermercado: "Tenda",
        produto: melhorOpcao.nome,
        preco: melhorOpcao.preco,
        preco_por_kg: +(melhorOpcao.preco / extrairPeso(melhorOpcao.nome)).toFixed(2)
      });
      console.log(`✅ ${melhorOpcao.nome} - R$ ${melhorOpcao.preco.toFixed(2)}`);
    }
  }

  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), "utf-8");
  
  await browser.close();
  console.log(`📊 Finalizado Campinas: ${resultados.length} produtos.`);
}

main().catch(err => console.error("❌ Erro fatal:", err));
