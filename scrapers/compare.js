// scrapers/compare.js
const fs = require("fs");
const path = require("path");

// Caminhos dos JSONs
const goodbomFile   = path.join(__dirname, "..", "docs", "prices", "prices_goodbom.json");
const tendaFile     = path.join(__dirname, "..", "docs", "prices", "prices_tenda.json");
const arenaFile     = path.join(__dirname, "..", "docs", "prices", "prices_arena.json");
const savegnagoFile = path.join(__dirname, "..", "docs", "prices", "prices_savegnago.json");
const outputFile    = path.join(__dirname, "..", "docs", "prices", "compare.json");

// Função para carregar JSON
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

const goodbom   = load(goodbomFile);
const tenda     = load(tendaFile);
const arena     = load(arenaFile);
const savegnago = load(savegnagoFile);

// Garante número válido
function safeNumber(n) {
  n = parseFloat(n);
  return isNaN(n) || !isFinite(n) || n <= 0 ? 0 : n;
}

// Agrupar por id
function groupById(data) {
  const map = {};
  for (const item of data) {
    if (!map[item.id]) map[item.id] = [];
    map[item.id].push(item);
  }
  return map;
}

const goodbomById   = groupById(goodbom);
const tendaById     = groupById(tenda);
const arenaById     = groupById(arena);
const savegnagoById = groupById(savegnago);

// IDs presentes em Goodbom e Tenda
const ids = Object.keys(goodbomById).filter(id => tendaById[id]);

let totalGoodbom   = 0;
let totalTenda     = 0;
let totalArena     = 0;
let totalSavegnago = 0;
let escolhidos = [];

for (const id of ids) {
  const g = goodbomById[id].sort((a, b) => safeNumber(a.preco_por_kg) - safeNumber(b.preco_por_kg))[0];
  const t = tendaById[id].sort((a, b) => safeNumber(a.preco_por_kg) - safeNumber(b.preco_por_kg))[0];
  const a = arenaById[id]?.sort((x, y) => safeNumber(x.preco_por_kg) - safeNumber(y.preco_por_kg))[0]
           || { produto: null, preco: 0, preco_por_kg: 0 };
  const s = savegnagoById[id]?.sort((x, y) => safeNumber(x.preco_por_kg) - safeNumber(y.preco_por_kg))[0]
           || { produto: null, preco: 0, preco_por_kg: 0 };

  // >>> NOVO FILTRO: só inclui se TODOS os mercados têm preço_por_kg > 0
  const gVal = safeNumber(g.preco_por_kg);
  const tVal = safeNumber(t.preco_por_kg);
  const aVal = safeNumber(a.preco_por_kg);
  const sVal = safeNumber(s.preco_por_kg);
  if (gVal <= 0 || tVal <= 0 || aVal <= 0 || sVal <= 0) continue;

  // Totais = somatória por kg
  totalGoodbom   += gVal;
  totalTenda     += tVal;
  totalArena     += aVal;
  totalSavegnago += sVal;

  // Determinar mais barato (todos > 0)
  const preços = [
    { loja: "Goodbom", preco: gVal },
    { loja: "Tenda", preco: tVal },
    { loja: "Arena", preco: aVal },
    { loja: "Savegnago", preco: sVal },
  ];
  const mais_barato = preços.reduce((min, p) => (p.preco < min.preco ? p : min), preços[0]).loja;

  escolhidos.push({
    id,
    goodbom:   { nome: g.produto, preco: g.preco, preco_por_kg: g.preco_por_kg },
    tenda:     { nome: t.produto, preco: t.preco, preco_por_kg: t.preco_por_kg },
    arena:     { nome: a.produto, preco: a.preco, preco_por_kg: a.preco_por_kg },
    savegnago: { nome: s.produto, preco: s.preco, preco_por_kg: s.preco_por_kg },
    mais_barato
  });
}

// Salvar JSON final
const jsonFinal = {
  totalGoodbom:   totalGoodbom.toFixed(2),
  totalTenda:     totalTenda.toFixed(2),
  totalArena:     totalArena.toFixed(2),
  totalSavegnago: totalSavegnago.toFixed(2),
  produtos: escolhidos
};

if (!fs.existsSync(path.dirname(outputFile))) fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(jsonFinal, null, 2), "utf-8");
console.log(`💾 JSON final salvo em ${outputFile}`);

console.log("Produtos considerados:", escolhidos.length);
console.log("🛒 Total GoodBom:",   totalGoodbom.toFixed(2));
console.log("🛒 Total Tenda:",     totalTenda.toFixed(2));
console.log("🛒 Total Arena:",     totalArena.toFixed(2));
console.log("🛒 Total Savegnago:", totalSavegnago.toFixed(2));
console.log("\n📊 Comparação detalhada:");
console.table(escolhidos.map(e => ({
  ID: e.id,
  GoodBom:   `${e.goodbom.nome} - R$${e.goodbom.preco} (R$${e.goodbom.preco_por_kg}/kg)`,
  Tenda:     `${e.tenda.nome} - R$${e.tenda.preco} (R$${e.tenda.preco_por_kg}/kg)`,
  Arena:     `${e.arena.nome} - R$${e.arena.preco} (R$${e.arena.preco_por_kg}/kg)`,
  Savegnago: `${e.savegnago.nome} - R$${e.savegnago.preco} (R$${e.savegnago.preco_por_kg}/kg)`,
  "Mais barato": e.mais_barato
})));
