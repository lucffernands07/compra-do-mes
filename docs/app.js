async function carregarDados() {
  const resultadoDiv = document.getElementById("resultado");
  resultadoDiv.innerHTML = "Carregando...";

  const tryPaths = ["./prices/compare.json","prices/compare.json","/prices/compare.json"];
  try {
    let response = null;
    for (const p of tryPaths) {
      try { 
        const r = await fetch(p); 
        if (r.ok) { response = r; break; } 
      } catch {}
    }
    if (!response) throw new Error("Arquivo compare.json não encontrado");

    const data = await response.json();
    const produtos = Array.isArray(data.produtos) ? data.produtos : [];

    const toNumber = v => {
      if (v == null) return 0;
      const n = parseFloat(v.toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    // --- CÁLCULO DOS TOTAIS BASEADOS EM KG ---
    const calcularTotalPorKg = (loja) => {
      return produtos.reduce((acc, p) => {
        return acc + toNumber(p[loja]?.preco_por_kg);
      }, 0);
    };

    const totaisKg = {
      goodbom: calcularTotalPorKg('goodbom'),
      tenda: calcularTotalPorKg('tenda'),
      arena: calcularTotalPorKg('arena'),
      savegnago: calcularTotalPorKg('savegnago')
    };

    const quantidades = {
      goodbom: toNumber(data.encontradosGoodbom),
      tenda: toNumber(data.encontradosTenda),
      arena: toNumber(data.encontradosArena),
      savegnago: toNumber(data.encontradosSavegnago)
    };

    // Determinar o mais barato
    const maisBaratoKey = Object.keys(totaisKg).reduce((a, b) => totaisKg[a] <= totaisKg[b] ? a : b);
    const maisBaratoName = maisBaratoKey.charAt(0).toUpperCase() + maisBaratoKey.slice(1);
    const totalProdutosComparados = produtos.length;

    // ✅ 1. GERAR TABELA DE TOTAIS (Respeitando as classes do novo CSS)
    const tabelaTotais = `
      <table>
        <thead>
          <tr>
            <th>Mercado</th>
            <th>Soma KG</th>
            <th>Itens</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(totaisKg).map(loja => `
            <tr class="${maisBaratoKey === loja ? 'mais-barato' : ''}">
              <td>${loja.charAt(0).toUpperCase() + loja.slice(1)}</td>
              <td>R$ ${totaisKg[loja].toFixed(2)}</td>
              <td>${quantidades[loja]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // ✅ 2. GERAR CARD DE DESTAQUE (Vencedor e Total sem sobreposição)
    const cardDestaque = `
      <div class="card-destaque">
        <span class="vencedor-nome">🏆 Vencedor: ${maisBaratoName}</span>
        <span class="total-produtos">Total de produtos comparados: <strong>${totalProdutosComparados}</strong></span>
      </div>
      <h3>Produtos do dia (${maisBaratoName})</h3>
    `;

    // ✅ 3. GERAR LISTA DE PRODUTOS (Layout de Cards limpos)
    const listaProdutos = `
      <ul>
        ${produtos
          .filter(p => toNumber(p[maisBaratoKey]?.preco_por_kg) > 0)
          .map(p => {
            const item = p[maisBaratoKey];
            const precoKg = toNumber(item.preco_por_kg);
            const precoUn = toNumber(item.preco);
            return `
              <li class="item">
                <strong>${item.nome}</strong>
                <div class="preco-container">
                  <span class="preco">R$ ${precoUn.toFixed(2)}</span>
                  <span class="valor-emb">Kg: R$ ${precoKg.toFixed(2)}</span>
                </div>
              </li>`;
          }).join("")}
      </ul>
    `;

    // INJETAR TUDO NA ORDEM CORRETA
    resultadoDiv.innerHTML = tabelaTotais + cardDestaque + listaProdutos;

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    resultadoDiv.innerHTML = "Erro ao carregar dados.";
  }
}

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado!', reg))
      .catch(err => console.log('Erro ao registrar SW', err));
  });
}

carregarDados();
                          
