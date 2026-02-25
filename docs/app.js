async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  const selectCidade = document.getElementById("selectCidade");
  const subtitulo = document.getElementById("subtitulo-cidade");
  
  const cidade = selectCidade.value;
  resultadoDiv.innerHTML = '<div style="text-align:center; padding:50px;">Carregando preços...</div>';
  
  subtitulo.innerText = cidade === "campinas" ? "Campinas - SP" : "Hortolândia - SP";

  const jsonFile = cidade === "campinas" ? "compare_campinas.json" : "compare_hortolandia.json";
  const filePath = `./prices/${jsonFile}`;

  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("Arquivo não encontrado");

    const data = await response.json();
    const produtosBase = Array.isArray(data.produtos) ? data.produtos : [];

    if (produtosBase.length === 0) {
      resultadoDiv.innerHTML = '<div class="card-destaque">⚠️ Nenhum produto encontrado para esta cidade.</div>';
      return;
    }

    const toNumber = v => {
      if (v == null) return 0;
      const n = parseFloat(v.toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    // Identifica as chaves das lojas (ex: giga, tenda, carrefour)
    const lojasChaves = Object.keys(produtosBase[0] || {}).filter(k => 
      !['id', 'mais_barato', 'produto', 'preco', 'preco_por_kg'].includes(k)
    );

    // ✅ FILTRAGEM: Apenas produtos presentes em TODAS as lojas
    const produtosComuns = produtosBase.filter(p => {
      return lojasChaves.every(loja => toNumber(p[loja]?.preco) > 0);
    });

    if (produtosComuns.length === 0) {
      resultadoDiv.innerHTML = '<div class="card-destaque">⚠️ Nenhum produto em comum entre todos os mercados para comparação.</div>';
      return;
    }

    // --- CÁLCULO DO RANKING ---
      const ranking = lojasChaves.map(chave => {
      // 1. Soma da cesta comum (usando a chave original do array de produtos)
      const somaCestaComum = produtosComuns.reduce((acc, p) => acc + toNumber(p[chave]?.preco), 0);

      // 2. Localização inteligente da contagem (Resolve o erro do Pague Menos zerado)
      // Procuramos no objeto 'data' uma chave que, em minúsculas, seja igual a "encontrados" + chave
      const labelBusca = ("encontrados" + chave).toLowerCase();
      const chaveRealNoJson = Object.keys(data).find(k => k.toLowerCase() === labelBusca);
      
      // Se achar a chave (ex: encontradosPagueMenos), pega o valor; se não, 0.
      const totalIndividual = chaveRealNoJson ? data[chaveRealNoJson] : 0;

      // 3. Formata o nome para exibição (ex: paguemenos -> Paguemenos)
      const nomeExibicao = chave.charAt(0).toUpperCase() + chave.slice(1);

      return {
        id: chave,
        nomeExibicao: nomeExibicao,
        total: somaCestaComum,
        comprados: produtosComuns.length,
        encontrados: totalIndividual
      };
    });

    // ✅ ORDENAÇÃO PELO MENOR TOTAL
    ranking.sort((a, b) => a.total - b.total);

    const vencedor = ranking[0];
    const maisBaratoKey = vencedor.id;
    const maisBaratoName = vencedor.nomeExibicao;

    // ✅ 1. TABELA DE RANKING (Com a coluna Itens formatada: Comprados / Encontrados)
    const tabelaTotais = `
      <div class="titulo-sessao">
        <h2>Ranking: Itens em Comum</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:15%">Pos.</th>
            <th style="width:40%; text-align:left;">Mercado</th>
            <th style="width:30%">Total Cesta</th>
            <th style="width:15%">Itens</th>
          </tr>
        </thead>
        <tbody>
          ${ranking.map((loja, index) => `
            <tr class="${index === 0 ? 'mais-barato' : ''}">
              <td>${index + 1}º</td>
              <td style="text-align:left;"><strong>${loja.nomeExibicao}</strong></td>
              <td>R$ ${loja.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
              <td>${loja.comprados} / ${loja.encontrados}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const ultimaAtt = data.ultimaAtualizacao || "Data não disponível";
    const cardDestaque = `
      <div class="card-destaque">
        <span class="vencedor-nome">🏆 Líder em Economia: ${maisBaratoName}</span>
        <span class="total-produtos">Cesta comparada: <strong>${produtosComuns.length} produtos em todos</strong></span>
      </div>
      <div class="titulo-sessao">
        <h2>Melhores ofertas da cesta: ${maisBaratoName}</h2>
        <span class="data-atualizacao">Atualizado em: ${ultimaAtt}</span>
      </div>
    `;

    const listaProdutos = `
      <ul>
        ${produtosComuns.map(p => {
            const item = p[maisBaratoKey];
            return `
              <li class="item">
                <strong>${item.nome}</strong>
                <div class="preco-container">
                  <span class="preco">R$ ${toNumber(item.preco).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  <span class="valor-emb">Kg/L: R$ ${toNumber(item.preco_por_kg).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
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
        <p>Erro ao processar dados de <b>${cidade.toUpperCase()}</b>.</p>
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
      
