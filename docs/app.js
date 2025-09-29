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

    // totais em R$
    let totalGoodbom   = toNumber(data.totalGoodbom);
    let totalTenda     = toNumber(data.totalTenda);
    let totalArena     = toNumber(data.totalArena);
    let totalSavegnago = toNumber(data.totalSavegnago);

    // ✅ usar diretamente os encontrados do compare.json
    const qtdGoodbom   = toNumber(data.encontradosGoodbom);
    const qtdTenda     = toNumber(data.encontradosTenda);
    const qtdArena     = toNumber(data.encontradosArena);
    const qtdSavegnago = toNumber(data.encontradosSavegnago);

    // determinar mais barato
    const valores = {
      goodbom: totalGoodbom,
      tenda: totalTenda,
      arena: totalArena,
      savegnago: totalSavegnago
    };
    const maisBaratoKey = Object.keys(valores).reduce((a,b) => valores[a] <= valores[b] ? a : b);
    const maisBaratoName = maisBaratoKey.charAt(0).toUpperCase() + maisBaratoKey.slice(1);
    const valorMaisBarato = valores[maisBaratoKey];

    const totalProdutos = produtos.length;
    const produtosDisponiveis = produtos.filter(p => toNumber(p[maisBaratoKey]?.preco) > 0).length;
    const produtosFaltantes = totalProdutos - produtosDisponiveis;

    // tabela com nova coluna de quantidade
    const tabelaTotais = `
      <br><h2>Comparação de Preços</h2><br>
      <table>
        <thead>
          <tr>
            <th>Supermercado</th>
            <th>Total (R$)</th>
            <th>Qtd. Produtos Encontrados</th>
          </tr>
        </thead>
        <tbody>
          <tr ${maisBaratoKey==="goodbom"? 'class="mais-barato"':''}>
            <td>Goodbom</td>
            <td>R$ ${totalGoodbom.toFixed(2)}</td>
            <td>${qtdGoodbom}</td>
          </tr>
          <tr ${maisBaratoKey==="tenda"? 'class="mais-barato"':''}>
            <td>Tenda</td>
            <td>R$ ${totalTenda.toFixed(2)}</td>
            <td>${qtdTenda}</td>
          </tr>
          <tr ${maisBaratoKey==="arena"? 'class="mais-barato"':''}>
            <td>Arena</td>
            <td>R$ ${totalArena.toFixed(2)}</td>
            <td>${qtdArena}</td>
          </tr>
          <tr ${maisBaratoKey==="savegnago"? 'class="mais-barato"':''}>
            <td>Savegnago</td>
            <td>R$ ${totalSavegnago.toFixed(2)}</td>
            <td>${qtdSavegnago}</td>
          </tr>
        </tbody>
      </table>
      <br>
      <p>Supermercado mais barato: ${maisBaratoName} (R$ ${valorMaisBarato.toFixed(2)})</p>

      <p>Total de produtos comparados: ${totalProdutos}</p>
      
    `;

    // lista produtos do mais barato
    const listaProdutos = produtos
      .filter(p => toNumber(p[maisBaratoKey]?.preco) > 0)
      .map(p => {
        const nome = p[maisBaratoKey]?.nome || "Sem nome";
        const preco = toNumber(p[maisBaratoKey]?.preco);
        return `li"><li class="item"><div><strong>${nome}</strong></div><div><span class="preco">R$ ${preco.toFixed(2)}</span></div></li>`;
      }).join("");

    const listaHtml = `<h3>Produtos do ${maisBaratoName}</h3>${
      listaProdutos ? "<ul>" + listaProdutos + "</ul>" : "<p>Nenhum produto com preço disponível</p>"
    }`;

    resultadoDiv.innerHTML = tabelaTotais + listaHtml;

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

carregarDados();
