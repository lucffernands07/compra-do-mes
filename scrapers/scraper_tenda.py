import requests
import os

CEP = "13187-166"
BASE_DIR = os.path.join("docs", "prices")
FILE_PATH = os.path.join(BASE_DIR, "prices_tenda.py")

def get_bearer_token():
    url = "https://api.tendaatacado.com.br/api/public/oauth/access-token?g-recaptcha-response=null"
    response = requests.post(url)
    response.raise_for_status()
    data = response.json()
    return data["access_token"]

def set_cep(token):
    url = "https://api.tendaatacado.com.br/api/shopping-cart"
    headers = {
        "X-Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "customer": {
            "zipcode": CEP
        },
        "deliveryType": "DELIVERY"
    }
    response = requests.put(url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()

def buscar_produto(token, query="Bacon"):
    url = f"https://api.tendaatacado.com.br/api/public/retail/product?query={query}"
    headers = {
        "X-Authorization": f"Bearer {token}"
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    produtos = response.json().get("products", [])
    if not produtos:
        return None, None
    produto = produtos[0]
    nome = produto.get("name")
    preco = produto.get("price")
    return nome, preco

def salvar_preco(nome, preco):
    if not os.path.exists(BASE_DIR):
        os.makedirs(BASE_DIR)
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(f'PRODUCT_NAME = "{nome}"\n')
        f.write(f'PRODUCT_PRICE = {preco}\n')
    print(f"Salvo: {nome} - R$ {preco}")

def main():
    token = get_bearer_token()
    set_cep(token)
    nome, preco = buscar_produto(token)
    if nome and preco:
        salvar_preco(nome, preco)
    else:
        print("Produto não encontrado.")

if __name__ == "__main__":
    main()
