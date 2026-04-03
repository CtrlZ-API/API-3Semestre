import requests
import pandas as pd

def coletar_dados(codigo, estado, regiao, tipo):
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json"
    response = requests.get(url)
    data = response.json()

    df = pd.DataFrame(data)

    df["estado"] = estado
    df["regiao"] = regiao
    df["tipo"] = tipo

    return df


series_estados = [
    # ---------------- CENTRO-OESTE ----------------
    ("GO", "Centro-Oeste", "saldo", 14010),
    ("GO", "Centro-Oeste", "inadimplencia", 15869),

    ("DF", "Centro-Oeste", "saldo", 14008),
    ("DF", "Centro-Oeste", "inadimplencia", 15867),

    ("MT", "Centro-Oeste", "saldo", 14012),
    ("MT", "Centro-Oeste", "inadimplencia", 15871),

    ("MS", "Centro-Oeste", "saldo", 14013),
    ("MS", "Centro-Oeste", "inadimplencia", 15872),

    # ---------------- NORTE ----------------
    ("AC", "Norte", "saldo", 14002),
    ("AC", "Norte", "inadimplencia", 15861),

    ("AP", "Norte", "saldo", 14004),
    ("AP", "Norte", "inadimplencia", 15863),

    ("AM", "Norte", "saldo", 14005),
    ("AM", "Norte", "inadimplencia", 15864),

    ("PA", "Norte", "saldo", 14015),
    ("PA", "Norte", "inadimplencia", 15874),

    ("RO", "Norte", "saldo", 14023),
    ("RO", "Norte", "inadimplencia", 15882),

    ("RR", "Norte", "saldo", 14024),
    ("RR", "Norte", "inadimplencia", 15883),

    ("TO", "Norte", "saldo", 14028),
    ("TO", "Norte", "inadimplencia", 15887),

    # ---------------- NORDESTE ----------------
    ("AL", "Nordeste", "saldo", 14003),
    ("AL", "Nordeste", "inadimplencia", 15862),

    ("BA", "Nordeste", "saldo", 14006),
    ("BA", "Nordeste", "inadimplencia", 15865),

    ("CE", "Nordeste", "saldo", 14007),
    ("CE", "Nordeste", "inadimplencia", 15866),

    ("MA", "Nordeste", "saldo", 14011),
    ("MA", "Nordeste", "inadimplencia", 15870),

    ("PB", "Nordeste", "saldo", 14016),
    ("PB", "Nordeste", "inadimplencia", 15875),

    ("PE", "Nordeste", "saldo", 14018),
    ("PE", "Nordeste", "inadimplencia", 15877),

    ("PI", "Nordeste", "saldo", 14019),
    ("PI", "Nordeste", "inadimplencia", 15878),

    ("RN", "Nordeste", "saldo", 14021),
    ("RN", "Nordeste", "inadimplencia", 15880),

    ("SE", "Nordeste", "saldo", 14027),
    ("SE", "Nordeste", "inadimplencia", 15886),

    # ---------------- SUDESTE ----------------
    ("ES", "Sudeste", "saldo", 14009),
    ("ES", "Sudeste", "inadimplencia", 15868),

    ("MG", "Sudeste", "saldo", 14014),
    ("MG", "Sudeste", "inadimplencia", 15873),

    ("RJ", "Sudeste", "saldo", 14020),
    ("RJ", "Sudeste", "inadimplencia", 15879),

    ("SP", "Sudeste", "saldo", 14026),
    ("SP", "Sudeste", "inadimplencia", 15885),

    # ---------------- SUL ----------------
    ("SC", "Sul", "saldo", 14025),
    ("SC", "Sul", "inadimplencia", 15884),

    ("PR", "Sul", "saldo", 14017),
    ("PR", "Sul", "inadimplencia", 15876),

    ("RS", "Sul", "saldo", 14022),
    ("RS", "Sul", "inadimplencia", 15881),
]


dfs = []

for estado, regiao, tipo, codigo in series_estados:
    df = coletar_dados(codigo, estado, regiao, tipo)
    dfs.append(df)

df_final = pd.concat(dfs)

df_final["data"]  = pd.to_datetime(df_final["data"], dayfirst=True)
df_final["valor"] = pd.to_numeric(df_final["valor"], errors="coerce")

df_final = df_final.dropna()
df_final = df_final.sort_values(by=["estado", "tipo", "data"])


df_saldo = df_final[df_final["tipo"] == "saldo"].copy()

df_saldo["valor"] = (
    df_saldo
    .groupby("estado")["valor"]         
    .diff()                              
)

df_saldo["tipo"] = "variacao"
df_saldo = df_saldo.dropna()            

df_final = pd.concat([df_final, df_saldo]).sort_values(by=["estado", "tipo", "data"])

print(df_final[df_final["tipo"] == "variacao"].head(10))
print(f"\nTotal de registros: {len(df_final)}")
print(f"Tipos disponíveis: {df_final['tipo'].unique()}")