const fs = require("fs");
const path = require("path");

// Caminhos dos JSONs
const goodbomFile = path.join(__dirname, "..", "docs", "prices", "prices_goodbom.json");
const tendaFile = path.join(__dirname, "..", "docs", "prices", "prices_tenda.json");
const outputFile = path.join(__dirname, "..", "docs", "prices", "compare.json"); // JSON final para o front

// Carrega os preços
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

const goodbom = load(goodbomFile);
const tenda = load(tendaFile);

// Agrupar por id
function groupById(data) {
  const map = {};
  for (const item of data) {
    if (!map[item.id]) map[item.id] = [];
    map[item.id].push(item);
  }
  return map;
}

const goodbomById = groupById(goodbom);
const tendaById = groupById(tenda);

// Comparar apenas ids que existem nos dois mercados
const ids = Object.keys(goodbomById).filter(id => tendaById[id]);

let totalGoodbom = 0;
let totalTenda = 0;
let escolhidos = [];

for (const id of ids) {
  const g = goodbomById[id].sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0]; // mais barato no Goodbom
  const t = tendaById[id].sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];   // mais barato no Tenda

  totalGoodbom += g.preco;
  totalTenda += t.preco;

  escolhidos.push({
    id,
    goodbom: { nome: g.produto, preco: g.preco, preco_por_kg: g.preco_por_kg },
    tenda: { nome: t.produto, preco: t.preco, preco_por_kg: t.preco_por_kg },
    mais_barato: g.preco_por_kg <= t.preco_por_kg ? "Goodbom" : "Tenda"
  });
}

// Salvar JSON final para o front
const jsonFinal = {
  totalGoodbom: totalGoodbom.toFixed(2),
  totalTenda: totalTenda.toFixed(2),
  produtos: escolhidos
};

if (!fs.existsSync(path.dirname(outputFile))) fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(jsonFinal, null, 2), "utf-8");
console.log(`💾 JSON final salvo em ${outputFile}`);

// Log no terminal
console.log("Produtos considerados:", ids.length);
console.log("💰 Total GoodBom:", totalGoodbom.toFixed(2));
console.log("💰 Total Tenda:", totalTenda.toFixed(2));
console.log("\n📊 Comparação detalhada:");
console.table(escolhidos.map(e => ({
  ID: e.id,
  GoodBom: `${e.goodbom.nome} - R$${e.goodbom.preco} (R$${e.goodbom.preco_por_kg}/kg)`,
  Tenda: `${e.tenda.nome} - R$${e.tenda.preco} (R$${e.tenda.preco_por_kg}/kg)`,
  "Mais barato": e.mais_barato
})));
