const resultadoDiv = document.getElementById("resultado");

async function atualizarPrecos() {
  resultadoDiv.innerHTML = "<p>Carregando...</p>";

  try {
    // Busca o JSON publicado no GitHub Pages
    const res = await fetch("prices/compare.json");
    const data = await res.json();

    // Verifica se há produtos
    if (!data.produtos || data.produtos.length === 0) {
      resultadoDiv.innerHTML = "<p>Nenhum produto encontrado.</p>";
      return;
    }

    // Monta o HTML com os totais
    let html = `
      <h2>Totais</h2>
      <p><strong>Total GoodBom:</strong> R$ ${data.totalGoodbom.toFixed(2)}</p>
      <p><strong>Total Tenda:</strong> R$ ${data.totalTenda.toFixed(2)}</p>

      <h2>Comparação detalhada</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Produto GoodBom</th>
            <th>Preço GoodBom (R$/kg)</th>
            <th>Produto Tenda</th>
            <th>Preço Tenda (R$/kg)</th>
            <th>Mais Barato</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Percorre os produtos
    data.produtos.forEach((p) => {
      const maisBaratoClasse =
        p.mais_barato === "Goodbom" ? "goodbom" : "tenda";

      html += `
        <tr>
          <td>${p.id}</td>
          <td>${p.goodbom.nome}</td>
          <td>R$ ${p.goodbom.preco_por_kg.toFixed(2)}</td>
          <td>${p.tenda.nome}</td>
          <td>R$ ${p.tenda.preco_por_kg.toFixed(2)}</td>
          <td class="${maisBaratoClasse}">${p.mais_barato}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    resultadoDiv.innerHTML = html;
  } catch (err) {
    console.error("Erro ao carregar JSON:", err);
    resultadoDiv.innerHTML = "<p>Erro ao buscar preços.</p>";
  }
}

// Atualiza automaticamente ao carregar a página
document.addEventListener("DOMContentLoaded", atualizarPrecos);
