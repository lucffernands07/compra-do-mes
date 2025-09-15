const fs = require("fs");
const path = require("path");

// Caminho dos arquivos JSON
const tendaPath = path.join(__dirname, "..", "docs", "prices", "prices_tenda.json");
const goodbomPath = path.join(__dirname, "..", "docs", "prices", "prices_goodbom.json");

// Lê os arquivos
const tenda = JSON.parse(fs.readFileSync(tendaPath, "utf-8"));
const goodbom = JSON.parse(fs.readFileSync(goodbomPath, "utf-8"));

// Cria um mapa do produto para o preço por kg de cada mercado
function criarMapaPorKg(lista) {
  const mapa = {};
  lista.forEach(item => {
    if (item.preco_por_kg > 0) { // ignora produtos com preço zero
      if (!mapa[item.produto] || item.preco_por_kg < mapa[item.produto].preco_por_kg) {
        mapa[item.produto] = item;
      }
    }
  });
  return mapa;
}

const mapaTenda = criarMapaPorKg(tenda);
const mapaGoodbom = criarMapaPorKg(goodbom);

// Lista apenas produtos que existem nos dois mercados
const produtosComuns = Object.keys(mapaTenda).filter(prod => mapaGoodbom[prod]);

let totalTenda = 0;
let totalGoodbom = 0;

produtosComuns.forEach(prod => {
  totalTenda += mapaTenda[prod].preco_por_kg;
  totalGoodbom += mapaGoodbom[prod].preco_por_kg;
});

console.log("Produtos considerados (presentes nos dois mercados):", produtosComuns.length);
console.log("💰 Total Tenda:", totalTenda.toFixed(2));
console.log("💰 Total GoodBom:", totalGoodbom.toFixed(2));
