import requests
import pandas as pd

def coletar_dados(codigo, nome_indicador):
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json"

    response = requests.get(url)
    data = response.json()

    df = pd.DataFrame(data)

    df["indicador"] = nome_indicador

    return df


series = {
    "concessoes": 20633,
    "saldo": 22050,
    "inadimplencia": 21112,
    "endividamento": 29037
}

dfs = []

for nome, codigo in series.items():
    df = coletar_dados(codigo, nome)
    dfs.append(df)

df_final = pd.concat(dfs)

df_final["data"] = pd.to_datetime(df_final["data"], dayfirst=True)

df_final["valor"] = pd.to_numeric(df_final["valor"], errors="coerce")

df_final = df_final.dropna()

df_final = df_final.sort_values(by="data")

