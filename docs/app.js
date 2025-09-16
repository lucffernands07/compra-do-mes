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

// === INÍCIO DO AJUSTE NOVO ===

// Calcular totais
let totalGoodbom = 0;
let totalTenda = 0;

data.produtos.forEach(produto => {
  const precoGoodbom = parseFloat(produto.goodbom?.preco?.replace(",", ".") || 0);
  const precoTenda = parseFloat(produto.tenda?.preco?.replace(",", ".") || 0);
  totalGoodbom += precoGoodbom;
  totalTenda += precoTenda;
});

// Determinar mais barato
const maisBarato = totalGoodbom <= totalTenda ? "Goodbom" : "Tenda";
const totalMaisBarato = Math.min(totalGoodbom, totalTenda);

// Monta tabela de totais
const tabelaTotais = `
  <h2>Totais por supermercado</h2>
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
  <p>Supermercado mais barato: <strong>${maisBarato} (R$ ${totalMaisBarato.toFixed(2)})</strong></p>
`;

// Lista de produtos do supermercado mais barato
const listaProdutos = data.produtos
  .filter(p => p[maisBarato.toLowerCase()])
  .map(p => {
    const nome = p[maisBarato.toLowerCase()]?.nome || "Sem nome";
    const preco = p[maisBarato.toLowerCase()]?.preco || "—";
    return `<li>${nome}: R$ ${preco}</li>`;
  })
  .join("");

// Atualiza o resultado adicionando os novos elementos antes da lista original
resultadoDiv.innerHTML = tabelaTotais + "<h3>Produtos do supermercado mais barato:</h3><ul>" + listaProdutos + "</ul>" + resultadoDiv.innerHTML;

// === FIM DO AJUSTE NOVO ===
