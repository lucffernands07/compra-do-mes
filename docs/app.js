// Após calcular e renderizar a lista de produtos
let totalGoodbom = 0;
let totalTenda = 0;

data.produtos.forEach(produto => {
  if (produto.goodbom?.preco) totalGoodbom += parseFloat(produto.goodbom.preco);
  if (produto.tenda?.preco) totalTenda += parseFloat(produto.tenda.preco);
});

const maisBarato = totalGoodbom <= totalTenda ? "Goodbom" : "Tenda";
const totalMaisBarato = Math.min(totalGoodbom, totalTenda);

// Monta a tabela de totais
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

resultadoDiv.innerHTML = tabelaTotais + resultadoDiv.innerHTML;

// Lista de produtos do supermercado mais barato
const listaProdutos = data.produtos
  .filter(p => p[maisBarato.toLowerCase()])
  .map(p => {
    const nome = p[maisBarato.toLowerCase()]?.nome || "Sem nome";
    const preco = p[maisBarato.toLowerCase()]?.preco || "—";
    return `<li>${nome}: R$ ${preco}</li>`;
  })
  .join("");

resultadoDiv.innerHTML += `<h3>Produtos no ${maisBarato}</h3><ul>${listaProdutos}</ul>`;
