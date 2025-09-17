async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");

  try {
    // Caminho relativo à pasta onde está o index.html
    const response = await fetch("./prices/compare.json");
    
    if (!response.ok) {
      throw new Error("Erro ao carregar o JSON: " + response.status);
    }

    const data = await response.json();

    // Garante que produtos existe e tem itens
    if (!data.produtos || data.produtos.length === 0) {
      resultadoDiv.innerHTML = "Nenhum produto encontrado";
      return;
    }

    // Calcula os totais de cada supermercado
    let totalGoodbom = 0;
    let totalTenda = 0;

    data.produtos.forEach(produto => {
      const precoGoodbom = parseFloat(produto.goodbom?.preco?.replace(",", ".") || 0);
      const precoTenda = parseFloat(produto.tenda?.preco?.replace(",", ".") || 0);
      totalGoodbom += precoGoodbom;
      totalTenda += precoTenda;
    });

    // Determina o supermercado mais barato
    let maisBarato = "Goodbom";
    let valorMaisBarato = totalGoodbom;
    if (totalTenda < totalGoodbom) {
      maisBarato = "Tenda";
      valorMaisBarato = totalTenda;
    }

    // Monta a tabela de totais
    let html = `
      <h2>Comparação de Preços</h2>
      <h3>Totais por supermercado</h3>
      <table border="1" cellpadding="5">
        <tr>
          <th>Supermercado</th>
          <th>Total (R$)</th>
        </tr>
        <tr ${maisBarato === "Goodbom" ? 'style="font-weight:bold;color:green;"' : ''}>
          <td>Goodbom</td>
          <td>${totalGoodbom.toFixed(2)}</td>
        </tr>
        <tr ${maisBarato === "Tenda" ? 'style="font-weight:bold;color:green;"' : ''}>
          <td>Tenda</td>
          <td>${totalTenda.toFixed(2)}</td>
        </tr>
      </table>
      <p>Supermercado mais barato: <strong>${maisBarato} (R$ ${valorMaisBarato.toFixed(2)})</strong></p>
    `;

    // Lista de produtos apenas do supermercado mais barato
    const listaProdutos = data.produtos
      .filter(p => p[maisBarato.toLowerCase()])
      .map(p => {
        const nome = p[maisBarato.toLowerCase()]?.nome || "Sem nome";
        const preco = p[maisBarato.toLowerCase()]?.preco || "—";
        return `<li>${nome}: R$ ${preco}</li>`;
      })
      .join("");

    html += `<h3>Produtos do ${maisBarato}</h3><ul>${listaProdutos}</ul>`;

    // Atualiza o resultado
    resultadoDiv.innerHTML = html;

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

carregarDados();
