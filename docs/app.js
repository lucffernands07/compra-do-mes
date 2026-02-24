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
    const produtos = Array.isArray(data.produtos) ? data.produtos : [];

    if (produtos.length === 0) {
      resultadoDiv.innerHTML = '<div class="card-destaque">⚠️ Nenhum produto encontrado para esta cidade.</div>';
      return;
    }

    // Função auxiliar para garantir que valores virem números tratáveis
    const toNumber = v => {
      if (v == null) return 0;
      const n = parseFloat(v.toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    // Identifica as chaves das lojas dinamicamente (ex: carrefour, tenda, etc)
    const lojasChaves = Object.keys(produtos[0] || {}).filter(k => 
      !['id', 'mais_barato', 'produto', 'preco', 'preco_por_kg'].includes(k)
    );

    // --- CÁLCULO DO RANKING POR TOTAL DA COMPRA ---
    const ranking = lojasChaves.map(chave => {
      // Formata a chave para bater com o padrão do JSON (ex: "tenda" vira "Tenda")
      const keyFormatada = chave.charAt(0).toUpperCase() + chave.slice(1);
      
      // Busca o total direto das propriedades do JSON (ex: data.totalTenda)
      const labelTotal = "total" + keyFormatada;
      const valorTotalCompra = toNumber(data[labelTotal]);
      
      // Busca a contagem de itens (ex: data.encontradosTenda)
      const labelContagem = "encontrados" + keyFormatada;
      const qtdItens = data[labelContagem] || 0;

      return {
        id: chave,
        nomeExibicao: keyFormatada,
        total: valorTotalCompra,
        itens: qtdItens
      };
    }).filter(loja => loja.total > 0);

    // ✅ ORDENAÇÃO PELO MENOR TOTAL DA COMPRA
    ranking.sort((a, b) => a.total - b.total);

    const vencedor = ranking[0];
    const maisBaratoKey = vencedor.id;
    const maisBaratoName = vencedor.nomeExibicao;
    const totalProdutosComparados = produtos.length;

    // ✅ 1. TABELA DE RANKING (Exibindo Totais Reais)
    const tabelaTotais = `
      <div class="titulo-sessao">
        <h2>Ranking: Economia Total</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:15%">Pos.</th>
            <th style="width:40%; text-align:left;">Mercado</th>
            <th style="width:30%">Total Compra</th>
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
          .filter(p => toNumber(p[maisBaratoKey]?.preco) > 0)
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
        <p>Preços de <b>${cidade.toUpperCase()}</b> ainda não processados hoje.</p>
      </div>`;
  }
}

document.getElementById("selectCidade").addEventListener("change", carregarDados);

// Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('Erro SW:', err));
  });
}

// Inicializa o app
carregarDados();
          
