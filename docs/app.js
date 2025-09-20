// docs/app.js
async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  resultadoDiv.innerHTML = "Carregando...";

  const tryPaths = ["./prices/compare.json","prices/compare.json","/prices/compare.json"];
  try {
    let response = null;
    for (const p of tryPaths) {
      try { 
        const r = await fetch(p); 
        if (r.ok) { response = r; break; } 
      } catch {}
    }
    if (!response) throw new Error("Arquivo compare.json não encontrado");

    const text = await response.text();
    const data = JSON.parse(text);
    const produtos = Array.isArray(data.produtos) ? data.produtos : [];

    const toNumber = v => {
      if (v == null) return 0;
      const n = parseFloat(v.toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    // inicializar totais a partir do JSON
    let totalGoodbom = toNumber(data.totalGoodbom);
    let totalTenda = toNumber(data.totalTenda);
    let totalArena = toNumber(data.totalArena);
    let totalSavegnago = toNumber(data.totalSavegnago);

    // determinar mais barato (inclui todos os mercados)
    const valores = { goodbom: totalGoodbom, tenda: totalTenda, arena: totalArena, savegnago: totalSavegnago };
    const maisBaratoKey = Object.keys(valores).reduce((a,b) => valores[a]<=valores[b]?a:b);
    const maisBaratoName = maisBaratoKey.charAt(0).toUpperCase() + maisBaratoKey.slice(1);
    const valorMaisBarato = valores[maisBaratoKey];

    // 🔢 NOVOS CÁLCULOS
    const totalProdutos = produtos.length; // todos os produtos comparados
    const produtosDisponiveis = produtos.filter(p => toNumber(p[maisBaratoKey]?.preco) > 0).length;
    const produtosFaltantes = totalProdutos - produtosDisponiveis;

    // tabela de totais
    const tabelaTotais = `
      <br><h2>Comparação de Preços</h2><br>
      <table>
        <thead><tr><th>Supermercado</th><th>Total (R$)</th></tr></thead>
        <tbody>
          <tr ${maisBaratoKey==="goodbom"? 'class="mais-barato"':''}><td>Goodbom</td><td>R$ ${totalGoodbom.toFixed(2)}</td></tr>
          <tr ${maisBaratoKey==="tenda"? 'class="mais-barato"':''}><td>Tenda</td><td>R$ ${totalTenda.toFixed(2)}</td></tr>
          <tr ${maisBaratoKey==="arena"? 'class="mais-barato"':''}><td>Arena</td><td>R$ ${totalArena.toFixed(2)}</td></tr>
          <tr ${maisBaratoKey==="savegnago"? 'class="mais-barato"':''}><td>Savegnago</td><td>R$ ${totalSavegnago.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <br>
      <p>Supermercado mais barato: <strong>${maisBaratoName} (R$ ${valorMaisBarato.toFixed(2)})</strong></p>

      <!-- ✅ Novas informações -->
      <p>Total de produtos comparados: <strong>${totalProdutos}</strong></p>
      <p>Produtos faltando no ${maisBaratoName}: <strong>${produtosFaltantes}</strong></p>
    `;

    // lista dos produtos do supermercado mais barato
    const listaProdutos = produtos
      .filter(p => toNumber(p[maisBaratoKey]?.preco) > 0)
      .map(p => {
        const nome = p[maisBaratoKey]?.nome || "Sem nome";
        const preco = toNumber(p[maisBaratoKey]?.preco);
        return `<li class="item"><div><strong>${nome}</strong></div><div><span class="preco">R$ ${preco.toFixed(2)}</span></div></li>`;
      }).join("");

    const listaHtml = `<h3>Produtos do ${maisBaratoName}</h3>${listaProdutos ? ("<ul>"+listaProdutos+"</ul>") : "<p>Nenhum produto com preço disponível</p>"}`;

    resultadoDiv.innerHTML = tabelaTotais + listaHtml;

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

carregarDados();
