const fs = require("fs");
const path = require("path");

// ✅ CORREÇÃO 1: Sobe dois níveis (.. , ..) para achar a pasta docs na raiz
const baseDir = path.resolve(__dirname, "..", "..", "docs", "prices");

const goodbomFile   = path.join(baseDir, "prices_goodbom.json");
const tendaFile     = path.join(baseDir, "prices_tenda_hortolandia.json"); // ✅ Nome atualizado
const arenaFile     = path.join(baseDir, "prices_arena.json");
const savegnagoFile = path.join(baseDir, "prices_savegnago.json");
const outputFile    = path.join(baseDir, "compare_hortolandia.json");

function load(file) {
  if (!fs.existsSync(file)) {
    console.log(`⚠️ Arquivo não encontrado: ${path.basename(file)}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

const rawGoodbom   = load(goodbomFile);
const rawTenda     = load(tendaFile);
const rawArena     = load(arenaFile);
const rawSavegnago = load(savegnagoFile);

function groupById(data) {
  const map = {};
  for (const item of data) {
    if (!map[item.id]) map[item.id] = [];
    map[item.id].push(item);
  }
  return map;
}

const goodbomById   = groupById(rawGoodbom);
const tendaById     = groupById(rawTenda);
const arenaById     = groupById(rawArena);
const savegnagoById = groupById(rawSavegnago);

// ✅ CORREÇÃO 2: Pega todos os IDs únicos que apareceram em QUALQUER mercado
const allIds = new Set([
  ...Object.keys(goodbomById),
  ...Object.keys(tendaById),
  ...Object.keys(arenaById),
  ...Object.keys(savegnagoById)
]);

let totalGoodbom = 0, totalTenda = 0, totalArena = 0, totalSavegnago = 0;
let escolhidos = [];

for (const id of allIds) {
  const g = goodbomById[id]?.[0]   || { produto: "N/A", preco: 0, preco_por_kg: 0 };
  const t = tendaById[id]?.[0]     || { produto: "N/A", preco: 0, preco_por_kg: 0 };
  const a = arenaById[id]?.[0]     || { produto: "N/A", preco: 0, preco_por_kg: 0 };
  const s = savegnagoById[id]?.[0] || { produto: "N/A", preco: 0, preco_por_kg: 0 };

  const precosValidos = [
    { loja: "Goodbom", valor: g.preco_por_kg },
    { loja: "Tenda", valor: t.preco_por_kg },
    { loja: "Arena", valor: a.preco_por_kg },
    { loja: "Savegnago", valor: s.preco_por_kg }
  ].filter(p => p.valor > 0);

  if (precosValidos.length === 0) continue;

  // Soma totais
  totalGoodbom   += g.preco_por_kg;
  totalTenda     += t.preco_por_kg;
  totalArena     += a.preco_por_kg;
  totalSavegnago += s.preco_por_kg;

  // Acha o campeão de preço deste item
  const mais_barato = precosValidos.reduce((min, p) => p.valor < min.valor ? p : min).loja;

  escolhidos.push({
    id: parseInt(id),
    goodbom:   { nome: g.produto, preco: g.preco, preco_por_kg: g.preco_por_kg },
    tenda:     { nome: t.produto, preco: t.preco, preco_por_kg: t.preco_por_kg },
    arena:     { nome: a.produto, preco: a.preco, preco_por_kg: a.preco_por_kg },
    savegnago: { nome: s.produto, preco: s.preco, preco_por_kg: s.preco_por_kg },
    mais_barato
  });
}

const jsonFinal = {
  ultimaAtualizacao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  totalGoodbom:   totalGoodbom.toFixed(2),
  totalTenda:     totalTenda.toFixed(2),
  totalArena:     totalArena.toFixed(2),
  totalSavegnago: totalSavegnago.toFixed(2),
  encontradosGoodbom: rawGoodbom.length,
  encontradosTenda: rawTenda.length,
  encontradosArena: rawArena.length,
  encontradosSavegnago: rawSavegnago.length,
  produtos: escolhidos.sort((a, b) => a.id - b.id)
};

fs.writeFileSync(outputFile, JSON.stringify(jsonFinal, null, 2), "utf-8");
console.log(`✅ Sucesso! Comparação de Hortolândia gerada com ${escolhidos.length} itens.`);
