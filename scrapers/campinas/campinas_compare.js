const fs = require("fs");
const path = require("path");

// Caminhos dos JSONs (Ajustados para a nova estrutura de pastas)
const pricesDir     = path.join(__dirname, "..", "..", "docs", "prices");
const carrefourFile = path.join(pricesDir, "prices_carrefour.json");
const gigaFile      = path.join(pricesDir, "prices_giga.json");
const covabraFile   = path.join(pricesDir, "prices_covabra.json");
const pagueMenosFile= path.join(pricesDir, "prices_pague_menos.json");
const atacadaoFile  = path.join(pricesDir, "prices_atacadao.json");
const tendaFile     = path.join(pricesDir, "prices_tenda_campinas.json");
const enxutoFile    = path.join(pricesDir, "prices_enxuto.json");
const outputFile    = path.join(pricesDir, "compare_campinas.json");

// Função para carregar JSON
function load(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    return [];
  }
}

// === Carrega dados brutos ===
const rawCarrefour  = load(carrefourFile);
const rawGiga       = load(gigaFile);
const rawCovabra    = load(covabraFile);
const rawPagueMenos = load(pagueMenosFile);
const rawAtacadao   = load(atacadaoFile);
const rawTenda      = load(tendaFile);
const rawEnxuto     = load(enxutoFile);

// === Funções Auxiliares ===
function safeNumber(n) {
  n = parseFloat(n);
  return isNaN(n) || !isFinite(n) || n <= 0 ? 0 : n;
}

function groupById(data) {
  const map = {};
  for (const item of data) {
    if (!map[item.id]) map[item.id] = [];
    map[item.id].push(item);
  }
  return map;
}

const carrefourById  = groupById(rawCarrefour);
const gigaById       = groupById(rawGiga);
const covabraById    = groupById(rawCovabra);
const pagueMenosById = groupById(rawPagueMenos);
const atacadaoById   = groupById(rawAtacadao);
const tendaById      = groupById(rawTenda);
const enxutoById     = groupById(rawEnxuto);

// IDs presentes em pelo menos dois mercados para comparação (Ex: Carrefour e Atacadão como base)
// Ou simplesmente pega todos os IDs únicos de todas as listas
const allIds = [...new Set([
  ...Object.keys(carrefourById),
  ...Object.keys(gigaById),
  ...Object.keys(covabraById),
  ...Object.keys(pagueMenosById),
  ...Object.keys(atacadaoById),
  ...Object.keys(tendaById),
  ...Object.keys(enxutoById)
])];

let totalCarrefour  = 0;
let totalGiga       = 0;
let totalCovabra    = 0;
let totalPagueMenos = 0;
let totalAtacadao   = 0;
let totalTenda      = 0;
let totalEnxuto     = 0;
let escolhidos = [];

for (const id of allIds) {
  const getItem = (map) => map[id]?.sort((a, b) => safeNumber(a.preco_por_kg) - safeNumber(b.preco_por_kg))[0] 
                          || { produto: "N/A", preco: 0, preco_por_kg: 0 };

  const c = getItem(carrefourById);
  const g = getItem(gigaById);
  const cv = getItem(covabraById);
  const pm = getItem(pagueMenosById);
  const at = getItem(atacadaoById);
  const t = getItem(tendaById);
  const ex = getItem(enxutoById);

  // Valores para cálculo
  const cVal  = safeNumber(c.preco_por_kg);
  const gVal  = safeNumber(g.preco_por_kg);
  const cvVal = safeNumber(cv.preco_por_kg);
  const pmVal = safeNumber(pm.preco_por_kg);
  const atVal = safeNumber(at.preco_por_kg);
  const tVal  = safeNumber(t.preco_por_kg);
  const exVal = safeNumber(ex.preco_por_kg);

  // Só inclui no JSON se houver pelo menos um preço válido
  if (cVal === 0 && gVal === 0 && cvVal === 0 && pmVal === 0 && atVal === 0 && tVal === 0 && exVal === 0) continue;

  // Somar totais
  totalCarrefour  += cVal;
  totalGiga       += gVal;
  totalCovabra    += cvVal;
  totalPagueMenos += pmVal;
  totalAtacadao   += atVal;
  totalTenda      += tVal;
  totalEnxuto     += exVal;

  // Determinar mais barato entre os disponíveis (> 0)
  const precos = [
    { loja: "Carrefour", preco: cVal },
    { loja: "Giga", preco: gVal },
    { loja: "Covabra", preco: cvVal },
    { loja: "Pague Menos", preco: pmVal },
    { loja: "Atacadão", preco: atVal },
    { loja: "Tenda", preco: tVal },
    { loja: "Enxuto", preco: exVal }
  ].filter(p => p.preco > 0);

  const mais_barato = precos.length > 0 
    ? precos.reduce((min, p) => (p.preco < min.preco ? p : min), precos[0]).loja 
    : "N/A";

  escolhidos.push({
    id,
    carrefour:  { nome: c.produto, preco: c.preco, preco_por_kg: c.preco_por_kg },
    giga:       { nome: g.produto, preco: g.preco, preco_por_kg: g.preco_por_kg },
    covabra:    { nome: cv.produto, preco: cv.preco, preco_por_kg: cv.preco_por_kg },
    paguemenos: { nome: pm.produto, preco: pm.preco, preco_por_kg: pm.preco_por_kg },
    atacadao:   { nome: at.produto, preco: at.preco, preco_por_kg: at.preco_por_kg },
    tenda:      { nome: t.produto, preco: t.preco, preco_por_kg: t.preco_por_kg },
    enxuto:     { nome: ex.produto, preco: ex.preco, preco_por_kg: ex.preco_por_kg },
    mais_barato
  });
}

const dataAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

const jsonFinal = {
  ultimaAtualizacao: dataAtualizacao,
  cidade: "Campinas",
  totalCarrefour:  totalCarrefour.toFixed(2),
  totalGiga:       totalGiga.toFixed(2),
  totalCovabra:    totalCovabra.toFixed(2),
  totalPagueMenos: totalPagueMenos.toFixed(2),
  totalAtacadao:   totalAtacadao.toFixed(2),
  totalTenda:      totalTenda.toFixed(2),
  totalEnxuto:     totalEnxuto.toFixed(2),
  encontradosCarrefour:  rawCarrefour.length,
  encontradosGiga:       rawGiga.length,
  encontradosCovabra:    rawCovabra.length,
  encontradosPagueMenos: rawPagueMenos.length,
  encontradosAtacadao:   rawAtacadao.length,
  encontradosTenda:      rawTenda.length,
  encontradosEnxuto:     rawEnxuto.length,
  produtos: escolhidos
};

if (!fs.existsSync(path.dirname(outputFile))) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}
fs.writeFileSync(outputFile, JSON.stringify(jsonFinal, null, 2), "utf-8");

console.log(`💾 JSON Campinas salvo em ${outputFile}`);
      
