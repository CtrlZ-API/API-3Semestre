import os
import sqlite3
import pandas as pd
from coleta import df_final

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

caminho_db = os.path.join(BASE_DIR, "..", "data", "dados_credito.db")

conn = sqlite3.connect(caminho_db)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS dados_credito (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data DATE,
    estado TEXT,
    regiao TEXT,
    tipo TEXT,
    valor REAL
)
""")

conn.commit()

df_final = df_final.drop_duplicates(
    subset=["data", "estado", "tipo"]
)

df_final.to_sql(
    "dados_credito",
    conn,
    if_exists="append", 
    index=False
)

conn.close()