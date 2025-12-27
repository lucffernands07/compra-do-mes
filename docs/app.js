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

    const data = await response.json();
    const produtos = Array.isArray(data.produtos) ? data.produtos : [];

    const toNumber = v => {
      if (v == null) return 0;
      const n = parseFloat(v.toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    // --- CÁLCULO DOS TOTAIS BASEADOS EM KG ---
    const calcularTotalPorKg = (loja) => {
      return produtos.reduce((acc, p) => {
        return acc + toNumber(p[loja]?.preco_por_kg);
      }, 0);
    };

    const totaisKg = {
      goodbom: calcularTotalPorKg('goodbom'),
      tenda: calcularTotalPorKg('tenda'),
      arena: calcularTotalPorKg('arena'),
      savegnago: calcularTotalPorKg('savegnago')
    };

    // Quantidades encontradas (informação vinda do JSON)
    const quantidades = {
      goodbom: toNumber(data.encontradosGoodbom),
      tenda: toNumber(data.encontradosTenda),
      arena: toNumber(data.encontradosArena),
      savegnago: toNumber(data.encontradosSavegnago)
    };

    // Determinar o mais barato
    const maisBaratoKey = Object.keys(totaisKg).reduce((a, b) => totaisKg[a] <= totaisKg[b] ? a : b);
    const maisBaratoName = maisBaratoKey.charAt(0).toUpperCase() + maisBaratoKey.slice(1);
    
    // ✅ Recupera o total de produtos comparados (itens que estão no JSON)
    const totalProdutosComparados = produtos.length;

    const tabelaTotais = `
      <br><h2>Comparação de Preços (Total por KG/L)</h2>
      <p><small>*Soma baseada no valor proporcional de 1kg/1L para cada item.</small></p>
      <table>
        <thead>
          <tr>
            <th>Supermercado</th>
            <th>Soma por KG (R$)</th>
            <th>Itens Encontrados</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(totaisKg).map(loja => `
            <tr ${maisBaratoKey === loja ? 'class="mais-barato"' : ''}>
              <td>${loja.charAt(0).toUpperCase() + loja.slice(1)}</td>
              <td>R$ ${totaisKg[loja].toFixed(2)}</td>
              <td>${quantidades[loja]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <br>
      <p>Vencedor (Mais barato p/ KG): <strong>${maisBaratoName}</strong></p>
      <p>Total de produtos comparados nesta lista: <strong>${totalProdutosComparados}</strong></p>
    `;

    // Lista de produtos
    const listaProdutos = produtos
      .filter(p => toNumber(p[maisBaratoKey]?.preco_por_kg) > 0)
      .map(p => {
        const item = p[maisBaratoKey];
        const precoKg = toNumber(item.preco_por_kg);
        const precoUn = toNumber(item.preco);
        return `
          <li class="item">
            <div><strong>${item.nome}</strong></div>
            <div>
              <span class="preco">R$ ${precoKg.toFixed(2)} /kg</span><br>
              <small>Valor da embalagem: R$ ${precoUn.toFixed(2)}</small>
            </div>
          </li>`;
      }).join("");

    resultadoDiv.innerHTML = tabelaTotais + `<h3>Produtos do ${maisBaratoName}</h3><ul>${listaProdutos}</ul>`;

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

carregarDados();
