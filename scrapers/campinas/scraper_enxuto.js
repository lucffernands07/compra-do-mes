const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const produtosTxtPath = path.join(__dirname, "..", "..", "products.txt");
const outDir = path.join(__dirname, "..", "..", "docs", "prices");

function normalizar(txt) {
  if (!txt) return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function extrairPeso(nome) {
  const n = nome.toLowerCase();
  // Captura unidades: 1kg, 500g, 12un, c/20, 1l, ml
  const match = n.match(/(\d+[.,]?\d*)\s*(g|kg|ml|l|un|c\/|unidades)/);
  if (!match) return 1;
  let qtd = parseFloat(match[1].replace(",", "."));
  const unidade = match[2];
  if (unidade === "g" || unidade === "ml") qtd /= 1000;
  return qtd || 1;
}

function parsePreco(txt) {
  if (!txt) return 0;
  // Limpeza para formatos como "R$ 13,99" ou milhar "1.200,00"
  const n = parseFloat(txt.replace("R$", "").replace(/\s/g, "").replace(".", "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 1024 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  if (!fs.existsSync(produtosTxtPath)) {
    console.error("❌ products.txt não encontrado!");
    await browser.close();
    return;
  }

  const linhasProdutos = fs.readFileSync(produtosTxtPath, "utf-8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

  const resultado = [];

  try {
    for (const [index, nomeOriginal] of linhasProdutos.entries()) {
      const id = index + 1;
      let termoParaBusca = nomeOriginal.replace(/\bkg\b/gi, "").replace(/\bg\b/gi, "").trim();
      const termoNorm = normalizar(termoParaBusca);

      console.log(`🔍 [Enxuto] Buscando: ${termoParaBusca}`);

      try {
        await page.goto(
          `https://www.enxuto.com/busca?termo=${encodeURIComponent(termoParaBusca)}`,
          { waitUntil: "networkidle0", timeout: 60000 }
        );

        await page.waitForSelector("[data-cy='produto-descricao']", { timeout: 15000 }).catch(() => null);
        
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 3500)); 

        const items = await page.evaluate(() => {
          const products = [];
          const labels = document.querySelectorAll("[data-cy='produto-descricao']");

          labels.forEach(label => {
            const card = label.closest("app-vip-card-produto") || label.closest(".vip-card-produto") || label.parentElement.parentElement;
            const precoEl = card.querySelector("[data-cy='preco']");
            
            if (label && precoEl) {
              products.push({
                nome: label.innerText.trim(),
                precoTxt: precoEl.innerText.trim()
              });
            }
          });
          return products;
        });

        // ✅ FILTRO COM PROTEÇÃO CONTRA INTRUSOS E VALIDAÇÃO DE CORES
        const filtrados = items.map(item => ({
          nome: item.nome,
          preco: parsePreco(item.precoTxt),
          peso_kg: extrairPeso(item.nome)
        })).filter(item => {
          const nomeNorm = normalizar(item.nome);
          const palavrasBusca = termoNorm.split(" ").filter(w => w.length >= 3);
          
          // 1. Verificação básica por prefixo (3 letras)
          const bateBusca = palavrasBusca.every(pal => nomeNorm.includes(pal.substring(0, 3)));
          
          // 2. Validação rigorosa de Cores (Evita trocar Pimentão Vermelho por Verde)
          const coresESabores = ["vermelho", "amarelo", "verde", "branco", "roxo"];
          const corNaBusca = coresESabores.find(cor => termoNorm.includes(cor));
          if (corNaBusca && !nomeNorm.includes(corNaBusca.substring(0, 5))) {
            return false; 
          }

          // 3. Bloqueio de Falsos Positivos (Bebidas, Cápsulas, Enlatados)
          const termosProibidos = [
            "gato", "dog", "doce", "listerine", "shampoo", "sabonete", 
            "bebida", "ice", "capsula", "cha", "sache", "conserva", "milho verde"
          ];
          const eProibido = termosProibidos.some(tp => nomeNorm.includes(tp));

          // 4. Regra específica para Cheiro Verde (evita Milho Verde)
          if (termoNorm.includes("cheiro") && !nomeNorm.includes("cheir")) return false;

          return item.preco > 0.5 && bateBusca && !eProibido;
        });

        if (filtrados.length > 0) {
          const melhor = filtrados.sort((a, b) => (a.preco / a.peso_kg) - (b.preco / b.peso_kg))[0];

          resultado.push({
            id,
            supermercado: "Enxuto",
            produto: melhor.nome,
            preco: melhor.preco,
            preco_por_kg: parseFloat((melhor.preco / melhor.peso_kg).toFixed(2))
          });

          console.log(`✅ ${melhor.nome} - R$ ${melhor.preco.toFixed(2)}`);
        } else {
          console.log(`❌ Nada relevante para: ${termoParaBusca}`);
        }
      } catch (e) {
        console.log(`⚠️ Erro ao processar: ${termoParaBusca}`);
      }
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "prices_enxuto.json"), JSON.stringify(resultado, null, 2), "utf-8");
    console.log(`\n📂 Finalizado! ${resultado.length} itens salvos.`);

  } finally {
    await browser.close();
  }
}

main();
            
