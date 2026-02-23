async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  const selectCidade = document.getElementById("selectCidade");
  const subtitulo = document.getElementById("subtitulo-cidade");
  
  const cidade = selectCidade.value;
  resultadoDiv.innerHTML = "Carregando...";
  
  // Atualiza o texto do subtítulo baseado na escolha
  subtitulo.innerText = cidade === "campinas" ? "Campinas - SP" : "Hortolândia - SP";

  // Define o arquivo correto para carregar
  const jsonFile = cidade === "campinas" ? "compare_campinas.json" : "compare.json";
  const path = `./prices/${jsonFile}`;

  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Arquivo não encontrado");

    const data = await response.json();
    const produtos = Array.isArray(data.produtos) ? data.produtos : [];

    const toNumber = v => {
      if (v == null) return 0;
      const n = parseFloat(v.toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    // --- DETECÇÃO DINÂMICA DE LOJAS ---
    // Pega todas as chaves do primeiro produto (exceto 'id' e 'mais_barato')
    const lojasChaves = Object.keys(produtos[0] || {}).filter(k => k !== 'id' && k !== 'mais_barato');

    // --- CÁLCULO DO RANKING ---
    const ranking = lojasChaves.map(chave => {
      const totalKg = produtos.reduce((acc, p) => acc + toNumber(p[chave]?.preco_por_kg), 0);
      
      // Busca a contagem de itens no JSON (ex: encontradosGoodbom ou encontradosCarrefour)
      const labelContagem = "encontrados" + chave.charAt(0).toUpperCase() + chave.slice(1);
      const qtdItens = data[labelContagem] || 0;

      return {
        id: chave,
        nomeExibicao: chave.charAt(0).toUpperCase() + chave.slice(1).replace("_", " "),
        total: totalKg,
        itens: qtdItens
      };
    });

    // Ordenar ranking: menor preço primeiro (quem tem total 0 vai para o fim)
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
            <th>Pos.</th>
            <th>Mercado</th>
            <th>Soma KG</th>
            <th>Itens</th>
          </tr>
        </thead>
        <tbody>
          ${ranking.map((loja, index) => `
            <tr class="${index === 0 ? 'mais-barato' : ''}">
              <td>${index + 1}º</td>
              <td>${loja.nomeExibicao}</td>
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
        <h2>Produtos do dia (${maisBaratoName})</h2>
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
    resultadoDiv.innerHTML = `<div class="card-destaque" style="background:#ffeeee; color:#cc0000;">
      ❌ Dados de ${cidade} não encontrados ou em processamento.
    </div>`;
  }
}

// Escuta a mudança no Select de Cidades
document.getElementById("selectCidade").addEventListener("change", carregarDados);

// Registro do Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado!', reg))
      .catch(err => console.log('Erro SW', err));
  });
}

// Inicia o app
carregarDados();
      
