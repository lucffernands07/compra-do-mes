// scrapers/compare.js
const fs = require("fs");
const path = require("path");

function loadJsonSafe(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      const raw = fs.readFileSync(filepath, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Erro ao ler", filepath, err);
  }
  return [];
}

// carrega cada mercado
const goodbom = loadJsonSafe(path.join(__dirname, "../docs/prices/prices_goodbom.json"));
const tenda   = loadJsonSafe(path.join(__dirname, "../docs/prices/prices_tenda.json"));
const arena   = loadJsonSafe(path.join(__dirname, "../docs/prices/prices_arena.json")); // novo

// index rápido por nome → normalizado
const normalize = str => (str || "").trim().toLowerCase();

const mapGoodbom = new Map(goodbom.map(p => [normalize(p.nome), p]));
const mapTenda   = new Map(tenda.map(p => [normalize(p.nome), p]));
const mapArena   = new Map(arena.map(p => [normalize(p.nome), p]));

// junta todos os nomes
const todosNomes = new Set([
  ...goodbom.map(p => normalize(p.nome)),
  ...tenda.map(p => normalize(p.nome)),
  ...arena.map(p => normalize(p.nome))
]);

// monta compare.json
const produtos = Array.from(todosNomes).map(nome => ({
  goodbom: mapGoodbom.get(nome) || null,
  tenda: mapTenda.get(nome) || null,
  arena: mapArena.get(nome) || null
}));

const outPath = path.join(__dirname, "../docs/prices/compare.json");
fs.writeFileSync(outPath, JSON.stringify({ produtos }, null, 2), "utf8");

console.log("Arquivo compare.json gerado com", produtos.length, "produtos.");
