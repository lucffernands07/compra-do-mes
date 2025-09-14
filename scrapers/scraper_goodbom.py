import requests  
from bs4 import BeautifulSoup  
import json  
import re

GOODBOM_URL = "https://www.goodbom.com.br/hortolandia/busca?q="
INPUT_FILE = "products.txt"
OUTPUT_JSON = "docs/prices_goodbom.json"  # arquivo separado
NUM_PRODUTOS = 3

def extrair_peso(nome):
    match = re.search(r"(\d+)\s*g", nome.lower())
    return int(match.group(1))/1000 if match else 1

def buscar_goodbom(produto):
    try:
        resp = requests.get(f"{GOODBOM_URL}{produto}", timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        encontrados = []

        for span in soup.find_all("span", class_="product-name")[:NUM_PRODUTOS]:
            a_tag = span.find_parent("a")
            preco_span = a_tag.find("span", class_="price") if a_tag else None
            if not preco_span: 
                continue

            nome = span.get_text(strip=True)
            if produto.lower() not in nome.lower():
                continue

            try:
                preco = float(preco_span.get_text(strip=True).replace("R$", "").split("/")[0].replace(",", ".").strip())
            except:
                continue

            peso_kg = extrair_peso(nome)
            encontrados.append({
                "supermercado": "Goodbom",
                "produto": nome,
                "preco": preco,
                "preco_por_kg": round(preco/peso_kg, 2)
            })

        return min(encontrados, key=lambda x: x["preco_por_kg"]) if encontrados else None
    except Exception as e:
        print(f"Erro Goodbom ({produto}): {e}")
        return None

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        produtos = [linha.strip() for linha in f if linha.strip()]

    resultados = []
    faltando = []

    for produto in produtos:
        item = buscar_goodbom(produto)
        if item:
            resultados.append(item)
        else:
            faltando.append(produto)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    print("\nProdutos encontrados Goodbom:")
    for item in resultados:
        print(f"- {item['produto']}: R$ {item['preco']} | R$ {item['preco_por_kg']}/kg")

    total = sum(item["preco"] for item in resultados)
    print(f"\nTotal: R$ {total:.2f}")

    if faltando:
        print(f"\nProdutos não encontrados ({len(faltando)}): {', '.join(faltando)}")

if __name__ == "__main__":
    main()
