const resultadoDiv = document.getElementById('resultado');

async function atualizarPrecos() {
  try {
    const res = await fetch("prices/compare.json");
    if (!res.ok) throw new Error(`Erro ao buscar JSON: ${res.status}`);
    const data = await res.json();

    if (!data.length) {
      resultadoDiv.innerHTML = "<p>Nenhum produto encontrado.</p>";
      return;
    }

    let html = `
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

    data.forEach(p => {
      const maisBaratoClasse = p.mais_barato === "Goodbom" ? "goodbom" : "tenda";
      html += `
        <tr>
          <td>${p.id}</td>
          <td>${p.goodbom.nome}</td>
          <td>R$${p.goodbom.preco_por_kg.toFixed(2)}</td>
          <td>${p.tenda.nome}</td>
          <td>R$${p.tenda.preco_por_kg.toFixed(2)}</td>
          <td class="${maisBaratoClasse}">${p.mais_barato}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    resultadoDiv.innerHTML = html;

  } catch (err) {
    console.error(err);
    resultadoDiv.innerHTML = "<p>Erro ao carregar preços.</p>";
  }
}

// Atualiza automaticamente ao carregar a página
document.addEventListener("DOMContentLoaded", atualizarPrecos);
