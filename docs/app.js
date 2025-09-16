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

    // Renderizar lista
    let html = "<ul>";
    data.produtos.forEach(produto => {
      const nome = produto.goodbom?.nome || "Sem nome";
      const precoGoodbom = produto.goodbom?.preco || "—";
      const precoTenda = produto.tenda?.preco || "—";

      html += `<li>
        <strong>${nome}</strong><br>
        Goodbom: R$ ${precoGoodbom} <br>
        Tenda: R$ ${precoTenda}
      </li>`;
    });
    html += "</ul>";

    resultadoDiv.innerHTML = html;
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

carregarDados();
