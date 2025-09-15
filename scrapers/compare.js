const fs = require("fs");
const path = require("path");

const productsFile = path.join(__dirname, "..", "products.txt");
const tendaFile = path.join(__dirname, "..", "docs", "prices", "prices_tenda.json");
const goodbomFile = path.join(__dirname, "..", "docs", "prices", "prices_goodbom.json");
const outFile = path.join(__dirname, "..", "docs", "prices", "comparison.json");

function loadJSON(file) {
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  }
  return [];
}

function main() {
  const produtos = fs.readFileSync(productsFile, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const tenda = loadJSON(tendaFile);
  const goodbom = loadJSON(goodbomFile);

  let totalTenda = 0;
  let totalGoodbom = 0;

  produtos.forEach(produto => {
    const itemTenda = tenda.find(p => p.produto.toLowerCase().includes(produto.toLowerCase()));
    const itemGoodbom = goodbom.find(p => p.produto.toLowerCase().includes(produto.toLowerCase()));

    // Somente se ambos tiverem preço > 0
    if (itemTenda?.preco > 0 && itemGoodbom?.preco > 0) {
      totalTenda += itemTenda.preco;
      totalGoodbom += itemGoodbom.preco;
    }
  });

  const resultado = {
    total_tenda: parseFloat(totalTenda.toFixed(2)),
    total_goodbom: parseFloat(totalGoodbom.toFixed(2))
  };

  fs.writeFileSync(outFile, JSON.stringify(resultado, null, 2), "utf-8");

  console.log("💾 Comparação salva em comparison.json");
  console.log("🛒 Total Tenda:", resultado.total_tenda);
  console.log("🛒 Total Goodbom:", resultado.total_goodbom);
}

main();
