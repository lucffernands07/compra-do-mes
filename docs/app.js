async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  const selectCidade = document.getElementById("selectCidade");
  const subtitulo = document.getElementById("subtitulo-cidade");
  
  const cidade = selectCidade.value;
  resultadoDiv.innerHTML = '<div style="text-align:center; padding:50px;">Carregando preços...</div>';
  
  // Atualiza o texto do subtítulo baseado na escolha
  subtitulo.innerText = cidade === "campinas" ? "Campinas - SP" : "Hortolândia - SP";

  // Define o arquivo correto para carregar (docs/prices/...)
  const jsonFile = cidade === "campinas" ? "compare_campinas.json" : "compare.json";
  const path = `./prices/${jsonFile}`;

  try {
    const response = await fetch(path);
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

    // --- DETECÇÃO DINÂMICA DE LOJAS ---
    const lojasChaves = Object.keys(produtos[0] || {}).filter(k => k !== 'id' && k !== 'mais_barato');

    // --- CÁLCULO DO RANKING ---
    const ranking = lojasChaves.map(chave => {
      const totalKg = produtos.reduce((acc, p) => acc + toNumber(p[chave]?.preco_por_kg), 0);
      
      // Busca contagem (ex: encontradosCarrefour, encontradosPaguemenos, encontradosGoodbom)
      // Normalizamos para camelCase básico
      const keyFormatada = chave.charAt(0).toUpperCase() + chave.slice(1).toLowerCase();
      const labelContagem = "encontrados" + keyFormatada;
      const qtdItens = data[labelContagem] || data[`encontrados${chave}`] || 0;

      return {
        id: chave,
        // Deixa o nome bonito: "paguemenos" -> "Paguemenos", "savegnago" -> "Savegnago"
        nomeExibicao: chave.charAt(0).toUpperCase() + chave.slice(1),
        total: totalKg,
        itens: qtdItens
      };
    });

    // Ordenar ranking: menor preço primeiro
    ranking.sort((a, b) => {
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });

    // O primeiro do ranking é o vencedor
    const vencedor = ranking[0];
    const maisBaratoKey = vencedor.id;
    const maisBaratoName = vencedor.nomeExibicao;
    const totalProdutosComparados = produtos.length;

    // ✅ 1. GERAR TABELA DE TOTAIS (RANKING ORDENADO)
    const tabelaTotais = `
      <table>
        <thead>
          <tr>
            <th style="width:50px">Pos.</th>
            <th>Mercado</th>
            <th>Soma KG</th>
            <th>Itens</th>
          </tr>
        </thead>
        <tbody>
          ${ranking.map((loja, index) => `
            <tr class="${index === 0 ? 'mais-barato' : ''}">
              <td>${index + 1}º</td>
              <td><strong>${loja.nomeExibicao}</strong></td>
              <td>R$ ${loja.total.toFixed(2)}</td>
              <td>${loja.itens}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // ✅ 2. GERAR CARD DE DESTAQUE
    const ultimaAtt = data.ultimaAtualizacao || "Data não disponível";
    const cardDestaque = `
      <div class="card-destaque">
        <span class="vencedor-nome">🏆 Vencedor: ${maisBaratoName}</span>
        <span class="total-produtos">Produtos comparados: <strong>${totalProdutosComparados}</strong></span>
      </div>
      <div class="titulo-sessao">
        <h2>Produtos do dia em ${maisBaratoName}</h2>
        <span class="data-atualizacao">Atualizado em: ${ultimaAtt}</span>
      </div>
    `;

    // ✅ 3. GERAR LISTA DE PRODUTOS
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
        <p>Os preços de <b>${cidade.toUpperCase()}</b> ainda não foram processados hoje.</p>
        <p style="font-size:12px; color:#666;">Verifique novamente em instantes.</p>
      </div>`;
  }
}

// Escuta a mudança no Select de Cidades
document.getElementById("selectCidade").addEventListener("change", carregarDados);

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW ok!'))
      .catch(err => console.log('Erro SW', err));
  });
}

// Inicia o app na primeira carga
carregarDados();
      
