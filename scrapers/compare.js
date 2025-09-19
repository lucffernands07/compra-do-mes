// scrapers/compare.js
const fs = require("fs");
const path = require("path");

// Caminhos dos JSONs
const goodbomFile   = path.join(__dirname, "..", "docs", "prices", "prices_goodbom.json");
const tendaFile     = path.join(__dirname, "..", "docs", "prices", "prices_tenda.json");
const arenaFile     = path.join(__dirname, "..", "docs", "prices", "prices_arena.json");
const savegnagoFile = path.join(__dirname, "..", "docs", "prices", "prices_savegnago.json");
const outputFile    = path.join(__dirname, "..", "docs", "prices", "compare.json"); // JSON final para o front

// Função para carregar JSON
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

const goodbom   = load(goodbomFile);
const tenda     = load(tendaFile);
const arena     = load(arenaFile);
const savegnago = load(savegnagoFile);

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

// Comparar apenas ids que existem nos dois mercados originais (Goodbom e Tenda)
const ids = Object.keys(goodbomById).filter(id => tendaById[id]);

let totalGoodbom   = 0;
let totalTenda     = 0;
let totalArena     = 0;
let totalSavegnago = 0;
let escolhidos = [];

for (const id of ids) {
  const g = goodbomById[id].sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];
  const t = tendaById[id].sort((a, b) => a.preco_por_kg - b.preco_por_kg)[0];
  const a = arenaById[id]?.sort((x, y) => x.preco_por_kg - y.preco_por_kg)[0]
           || { produto: null, preco: 0, preco_por_kg: Infinity };
  const s = savegnagoById[id]?.sort((x, y) => x.preco_por_kg - y.preco_por_kg)[0]
           || { produto: null, preco: 0, preco_por_kg: Infinity };

  // Totais = somatória por kg
  totalGoodbom   += g.preco_por_kg;
  totalTenda     += t.preco_por_kg;
  totalArena     += a.preco_por_kg;
  totalSavegnago += s.preco_por_kg;

  escolhidos.push({
    id,
    goodbom:   { nome: g.produto, preco: g.preco, preco_por_kg: g.preco_por_kg },
    tenda:     { nome: t.produto, preco: t.preco, preco_por_kg: t.preco_por_kg },
    arena:     { nome: a.produto, preco: a.preco, preco_por_kg: a.preco_por_kg },
    savegnago: { nome: s.produto, preco: s.preco, preco_por_kg: s.preco_por_kg },
    mais_barato:
      g.preco_por_kg <= t.preco_por_kg &&
      g.preco_por_kg <= a.preco_por_kg &&
      g.preco_por_kg <= s.preco_por_kg
        ? "Goodbom"
        : t.preco_por_kg <= a.preco_por_kg && t.preco_por_kg <= s.preco_por_kg
        ? "Tenda"
        : a.preco_por_kg <= s.preco_por_kg
        ? "Arena"
        : "Savegnago"
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

// Log resumido
console.log("Produtos considerados:", ids.length);
console.log("🛒 Total GoodBom:",   totalGoodbom.toFixed(2));
console.log("🛒 Total Tenda:",     totalTenda.toFixed(2));
console.log("🛒 Total Arena:",     totalArena.toFixed(2));
console.log("🛒 Total Savegnago:", totalSavegnago.toFixed(2));
console.log("\n📊 Comparação detalhada:");
console.table(escolhidos.map(e => ({
  ID: e.id,
  GoodBom:   `${e.goodbom.nome} - R$${e.goodbom.preco} (R$${e.goodbom.preco_por_kg}/kg)`,
  Tenda:     `${e.tenda.nome} - R$${e.tenda.preco} (R$${e.tenda.preco_por_kg}/kg)`,
  Arena:     `${e.arena.nome || "Sem nome"} - R$${e.arena.preco} (R$${e.arena.preco_por_kg}/kg)`,
  Savegnago: `${e.savegnago.nome || "Sem nome"} - R$${e.savegnago.preco} (R$${e.savegnago.preco_por_kg}/kg)`,
  "Mais barato": e.mais_barato
})));
