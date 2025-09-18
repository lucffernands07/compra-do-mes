// docs/app.js
async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  resultadoDiv.innerHTML = "Carregando...";

  const tryPaths = [
    "./prices/compare.json",
    "prices/compare.json",
    "/prices/compare.json"
  ];

  try {
    let response = null;
    let usedPath = null;

    for (const p of tryPaths) {
      try {
        const r = await fetch(p);
        if (r.ok) {
          response = r;
          usedPath = p;
          break;
        }
      } catch (e) {
        console.warn("[fetch] erro ao tentar", p, e);
      }
    }

    if (!response) throw new Error("compare.json não encontrado");

    const text = await response.text();
    let data = JSON.parse(text);

    const produtos = Array.isArray(data.produtos) ? data.produtos : (Array.isArray(data) ? data : []);
    if (!produtos || produtos.length === 0) {
      resultadoDiv.innerHTML = "Nenhum produto encontrado";
      return;
    }

    const toNumber = v => {
      if (v === null || v === undefined) return 0;
      const s = v.toString().replace(",", ".").replace(/[^0-9.\-]/g, "");
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };

    // totais
    let totalGoodbom = 0, totalTenda = 0, totalArena = 0;
    produtos.forEach(p => {
      totalGoodbom += toNumber(p.goodbom?.preco);
      totalTenda   += toNumber(p.tenda?.preco);
      totalArena   += toNumber(p.arena?.preco);
    });

    // determinar mais barato
    const totais = [
      { key: "goodbom", nome: "Goodbom", total: totalGoodbom },
      { key: "tenda", nome: "Tenda", total: totalTenda },
      { key: "arena", nome: "Arena", total: totalArena }
    ];

    const maisBarato = totais.reduce((a, b) => (a.total <= b.total ? a : b));

    // tabela de totais
    const tabelaTotais = `    
      <br><br>
      <h2>Comparação de Preços</h2>
      <br>
      <table>
        <thead>
          <tr><th>Supermercado</th><th>Total (R$)</th></tr>
        </thead>
        <tbody>
          ${totais.map(t => `
            <tr ${t.key === maisBarato.key ? 'class="mais-barato"' : ''}>
              <td>${t.nome}</td>
              <td>R$ ${t.total.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <br><br>
      <p>Supermercado mais barato: <strong>${maisBarato.nome} (R$ ${maisBarato.total.toFixed(2)})</strong></p>
    `;

    // lista de produtos do mais barato
    const listaProdutos = produtos
      .filter(p => toNumber(p[maisBarato.key]?.preco) > 0)
      .map(p => {
        const nome = p[maisBarato.key]?.nome || "Sem nome";
        const preco = p[maisBarato.key]?.preco ?? "—";
        return `<li class="item"><div><strong>${nome}</strong></div> <div><span class="preco">R$ ${preco}</span></div></li>`;
      })
      .join("");

    const listaMaisBaratoHtml = `
      <h3>Produtos do ${maisBarato.nome}</h3>
      ${listaProdutos ? ("<ul>" + listaProdutos + "</ul>") : "<p>Nenhum produto com preço disponível no ${maisBarato.nome}.</p>"}
    `;

    resultadoDiv.innerHTML = tabelaTotais + listaMaisBaratoHtml;

    console.log(`[RESUMO] goodbom=${totalGoodbom.toFixed(2)} tenda=${totalTenda.toFixed(2)} arena=${totalArena.toFixed(2)} maisBarato=${maisBarato.nome}`);

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

carregarDados();
