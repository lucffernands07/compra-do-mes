// determinar mais barato (ignora mercados com total 0)
const valoresOrig = {
  goodbom: totalGoodbom,
  tenda: totalTenda,
  arena: totalArena,
  savegnago: totalSavegnago
};

// filtra apenas os mercados com total > 0
const valores = Object.fromEntries(
  Object.entries(valoresOrig).filter(([_, v]) => v > 0)
);

// se todos forem 0, cai no original para evitar erro
const baseValores = Object.keys(valores).length ? valores : valoresOrig;

const maisBaratoKey = Object.keys(baseValores)
  .reduce((a, b) => baseValores[a] <= baseValores[b] ? a : b);
const maisBaratoName =
  maisBaratoKey.charAt(0).toUpperCase() + maisBaratoKey.slice(1);
const valorMaisBarato = baseValores[maisBaratoKey];
