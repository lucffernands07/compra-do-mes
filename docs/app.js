async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  const selectCidade = document.getElementById("selectCidade");
  const subtitulo = document.getElementById("subtitulo-cidade");
  
  const cidade = selectCidade.value;
  resultadoDiv.innerHTML = '<div style="text-align:center; padding:50px;">Carregando preços...</div>';
  
  subtitulo.innerText = cidade === "campinas" ? "Campinas - SP" : "Hortolândia - SP";

  const jsonFile = cidade === "campinas" ? "compare_campinas.json" : "hortolandia_compare.json";
  const filePath = `./prices/${jsonFile}`;

  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("Arquivo não encontrado");

    const data = await response.json();
    const produtos = Array.isArray(data.produtos) ? data.produtos : [];

    if (produtos.length === 0) {
      resultadoDiv.innerHTML = '<div class="card-destaque">⚠️ Nenhum produto encontrado para esta cidade.</div>';
      return;
    }

    const toNumber = v => {
      if (v == null) return 0;
      const n = parseFloat(v.toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    const lojasChaves = Object.keys(produtos[0] || {}).filter(k => k !== 'id' && k !== 'mais_barato');

    // --- CÁLCULO DO RANKING POR PREÇO MÉDIO ---
    const ranking = lojasChaves.map(chave => {
      const itensComPreco = produtos.filter(p => toNumber(p[chave]?.preco_por_kg) > 0);
      
      // Soma todos os preços por KG encontrados para esta loja
      const somaPrecoKg = itensComPreco.reduce((acc, p) => acc + toNumber(p[chave]?.preco_por_kg), 0);
      
      // Calcula a média (Soma / Quantidade de itens que ela achou)
      const precoMedioKg = itensComPreco.length > 0 ? (somaPrecoKg / itensComPreco.length) : 0;
      
      const keyFormatada = chave.charAt(0).toUpperCase() + chave.slice(1).toLowerCase();
      const labelContagem = "encontrados" + keyFormatada;
      const qtdItens = data[labelContagem] || itensComPreco.length;

      return {
        id: chave,
        nomeExibicao: chave.charAt(0).toUpperCase() + chave.slice(1),
        media: precoMedioKg,
        itens: qtdItens
      };
    }).filter(loja => loja.media > 0);

    // ✅ ORDENAÇÃO POR PREÇO MÉDIO (Menor para o maior)
    ranking.sort((a, b) => a.media - b.media);

    const vencedor = ranking[0];
    const maisBaratoKey = vencedor.id;
    const maisBaratoName = vencedor.nomeExibicao;
    const totalProdutosComparados = produtos.length;

    // ✅ 1. TABELA DE RANKING (POR MÉDIA)
    const tabelaTotais = `
      <div class="titulo-sessao">
        <h2>Ranking: Melhor Preço Médio</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:50px">Pos.</th>
            <th>Mercado</th>
            <th>Média R$/kg</th>
            <th>Achados</th>
          </tr>
        </thead>
        <tbody>
          ${ranking.map((loja, index) => `
            <tr class="${index === 0 ? 'mais-barato' : ''}">
              <td>${index + 1}º</td>
              <td><strong>${loja.nomeExibicao}</strong></td>
              <td>R$ ${loja.media.toFixed(2)}</td>
              <td>${loja.itens}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const ultimaAtt = data.ultimaAtualizacao || "Data não disponível";
    const cardDestaque = `
      <div class="card-destaque">
        <span class="vencedor-nome">🏆 Líder em Economia: ${maisBaratoName}</span>
        <span class="total-produtos">Base de comparação: <strong>${totalProdutosComparados} produtos</strong></span>
      </div>
      <div class="titulo-sessao">
        <h2>Melhores ofertas de hoje: ${maisBaratoName}</h2>
        <span class="data-atualizacao">Atualizado em: ${ultimaAtt}</span>
      </div>
    `;

    const listaProdutos = `
      <ul>
        ${produtos
          .filter(p => toNumber(p[maisBaratoKey]?.preco_por_kg) > 0)
          .map(p => {
            const item = p[maisBaratoKey];
            return `
              <li class="item">
                <strong>${item.nome}</strong>
                <div class="preco-container">
                  <span class="preco">R$ ${toNumber(item.preco).toFixed(2)}</span>
                  <span class="valor-emb">Kg/L: R$ ${toNumber(item.preco_por_kg).toFixed(2)}</span>
                </div>
              </li>`;
          }).join("")}
      </ul>
    `;

    resultadoDiv.innerHTML = tabelaTotais + cardDestaque + listaProdutos;

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = `
      <div style="padding:40px; text-align:center;">
        <div style="font-size:50px">🔍</div>
        <p>Preços de <b>${cidade.toUpperCase()}</b> não processados.</p>
      </div>`;
  }
}

document.getElementById("selectCidade").addEventListener("change", carregarDados);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('Erro SW:', err));
  });
}

carregarDados();
