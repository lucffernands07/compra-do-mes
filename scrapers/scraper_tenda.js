const items = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll("a.showcase-card-content")).slice(0, 3);
  return cards.map(card => {
    const nome = card.querySelector("h3.TitleCardComponent")?.innerText.trim() || null;

    const precoTxt = card.querySelector("div.SimplePriceComponent")?.innerText
      .replace("R$", "")
      .replace(",", ".")
      .replace("un", "")
      .trim();
    const preco = parseFloat(precoTxt) || 0;

    const precoKgTxt = Array.from(card.querySelectorAll("span")).find(s => s.innerText.includes("Valor do kg"))?.innerText
      .replace("Valor do kg: R$", "")
      .replace(",", ".")
      .trim();
    const preco_por_kg = parseFloat(precoKgTxt) || preco;

    return { produto: nome, preco, preco_por_kg };
  });
});
