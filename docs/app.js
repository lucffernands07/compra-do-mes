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

    // Identifica as lojas
    const lojasChaves = Object.keys(produtosBase[0] || {}).filter(k => 
      !['id', 'mais_barato', 'produto', 'preco', 'preco_por_kg'].includes(k)
    );

    // ✅ NOVA LÓGICA: Filtrar apenas produtos que existem em TODAS as lojas selecionadas
    const produtosComuns = produtosBase.filter(p => {
      return lojasChaves.every(loja => toNumber(p[loja]?.preco) > 0);
    });

    if (produtosComuns.length === 0) {
      resultadoDiv.innerHTML = '<div class="card-destaque">⚠️ Nenhum produto em comum entre todos os mercados para comparação.</div>';
      return;
    }

    // --- CÁLCULO DO RANKING POR SOMA DOS ITENS COMUNS ---
    const ranking = lojasChaves.map(chave => {
      const keyFormatada = chave.charAt(0).toUpperCase() + chave.slice(1);
      
      // ✅ Recalcula a soma usando apenas a cesta comum
      const somaCestaComum = produtosComuns.reduce((acc, p) => acc + toNumber(p[chave].preco), 0);

      return {
        id: chave,
        nomeExibicao: keyFormatada,
        total: somaCestaComum,
        itens: produtosComuns.length
      };
    });

    // ✅ ORDENAÇÃO PELO MENOR TOTAL DA CESTA COMUM
    ranking.sort((a, b) => a.total - b.total);

    const vencedor = ranking[0];
    const maisBaratoKey = vencedor.id;
    const maisBaratoName = vencedor.nomeExibicao;
    const totalComparadosCesta = produtosComuns.length;

    // ✅ 1. TABELA DE RANKING (Mantendo suas classes)
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
              <td>R$ ${loja.total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
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
        <span class="total-produtos">Cesta comparada: <strong>${totalComparadosCesta} produtos em todos</strong></span>
      </div>
      <div class="titulo-sessao">
        <h2>Melhores ofertas da cesta: ${maisBaratoName}</h2>
        <span class="data-atualizacao">Atualizado em: ${ultimaAtt}</span>
      </div>
    `;

    // Lista apenas os produtos da cesta comum
    const listaProdutos = `
      <ul>
        ${produtosComuns
          .map(p => {
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
      
