// docs/app.js
async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  resultadoDiv.innerHTML = "Carregando...";

  // caminhos a tentar (fallback)
  const tryPaths = [
    "./prices/compare.json",
    "prices/compare.json",
    "/prices/compare.json"
  ];

  try {
    let response = null;
    let usedPath = null;

    // tenta encontrar o arquivo em vários caminhos
    for (const p of tryPaths) {
      try {
        console.log("[fetch] tentando:", p);
        const r = await fetch(p);
        console.log("[fetch] status:", p, r.status);
        if (r.ok) {
          response = r;
          usedPath = p;
          break;
        }
      } catch (e) {
        console.warn("[fetch] erro ao tentar", p, e);
      }
    }

    if (!response) {
      throw new Error("Arquivo compare.json não encontrado (tentados: " + tryPaths.join(", ") + ")");
    }

    // ler corpo e tentar parsear JSON (com log em caso de erro)
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("[JSON] erro ao parsear JSON (mostrando início):", text.slice(0, 500));
      throw e;
    }

    console.log("[OK] compare.json carregado de:", usedPath);

    // normalizar produtos: aceita { produtos: [...] } ou [...] diretamente
    const produtos = Array.isArray(data.produtos) ? data.produtos : (Array.isArray(data) ? data : []);
    if (!produtos || produtos.length === 0) {
      console.warn("[DATA] nenhum produto encontrado no JSON. keys:", Object.keys(data));
      resultadoDiv.innerHTML = "Nenhum produto encontrado";
      return;
    }

    // helper: converte valores diversos para número seguro
    const toNumber = v => {
      if (v === null || v === undefined) return 0;
      const s = v.toString().replace(",", ".").replace(/[^0-9.\-]/g, "");
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };

    // calcular totais
    let totalGoodbom = 0;
    let totalTenda = 0;
    produtos.forEach(p => {
      totalGoodbom += toNumber(p.goodbom?.preco);
      totalTenda += toNumber(p.tenda?.preco);
    });

    // determinar mais barato
    const maisBaratoKey = totalGoodbom <= totalTenda ? "goodbom" : "tenda";
    const maisBaratoName = maisBaratoKey === "goodbom" ? "Goodbom" : "Tenda";
    const valorMaisBarato = Math.min(totalGoodbom, totalTenda);

    // montar tabela de totais (HTML simples — estilize no style.css se quiser)
    const tabelaTotais = `
      <h2>Comparação de Preços</h2>
      <h3>Totais por supermercado</h3>
      <table>
        <thead>
          <tr><th>Supermercado</th><th>Total (R$)</th></tr>
        </thead>
        <tbody>
          <tr ${maisBaratoName === "Goodbom" ? 'class="mais-barato"' : ''}>
            <td>Goodbom</td>
            <td>R$ ${totalGoodbom.toFixed(2)}</td>
          </tr>
          <tr ${maisBaratoName === "Tenda" ? 'class="mais-barato"' : ''}>
            <td>Tenda</td>
            <td>R$ ${totalTenda.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <p>Supermercado mais barato: <strong>${maisBaratoName} (R$ ${valorMaisBarato.toFixed(2)})</strong></p>
    `;

    // lista apenas dos produtos do supermercado mais barato (somente se tiver preço válido)
    const listaProdutos = produtos
      .filter(p => {
        // existe o objeto do supermercado e tem preço > 0
        const preco = toNumber(p[maisBaratoKey]?.preco);
        return preco > 0;
      })
      .map(p => {
        const nome = p[maisBaratoKey]?.nome || p.goodbom?.nome || p.tenda?.nome || "Sem nome";
        const preco = p[maisBaratoKey]?.preco ?? "—";
        return `<li><strong>${nome}</strong> <span class="preco">R$ ${preco}</span></li>`;
      })
      .join("");

    const listaMaisBaratoHtml = `
      <h3>Produtos do ${maisBaratoName}</h3>
      ${listaProdutos ? ("<ul>" + listaProdutos + "</ul>") : "<p>Nenhum produto com preço disponível no " + maisBaratoName + ".</p>"}
    `;

    // coloca tudo na página (apenas uma atribuição final)
    resultadoDiv.innerHTML = tabelaTotais + listaMaisBaratoHtml;

    // logs resumidos
    console.log(`[RESUMO] totalGoodbom=${totalGoodbom.toFixed(2)} totalTenda=${totalTenda.toFixed(2)} maisBarato=${maisBaratoName}`);

  } catch (err) {
    // mostra erro amigável no front e detalhes no console
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

carregarDados();
