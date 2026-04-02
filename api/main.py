import os
import sqlite3
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="API Crédito Brasil")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

def get_connection() -> sqlite3.Connection:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(BASE_DIR, "data", "dados_credito.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/")
def home():
    return {"msg": "API rodando"}


@app.get("/api/dados")
def get_dados(limite: int = Query(default=100, le=1000)):
    """Retorna os últimos N registros. Limite máximo: 1000."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dados_credito LIMIT ?", (limite,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]                


@app.get("/api/dados/estados")
def get_por_estados(tipo: str = Query(default="saldo")):
    """
    Retorna total e média por estado para um tipo de indicador.
    Usado pelo mapa coroplético e pelos cards de totais.
    tipo: 'saldo' | 'inadimplencia' | 'variacao'
    """
    conn = get_connection()
    cursor = conn.cursor()

    order_col = "media" if tipo == "variacao" else "total"

    cursor.execute(
        f"""
        SELECT
            estado,
            regiao,
            ROUND(SUM(valor), 2)  AS total,
            ROUND(AVG(valor), 2)  AS media
        FROM dados_credito
        WHERE tipo = ?
        GROUP BY estado, regiao
        ORDER BY {order_col} DESC
        """,
        (tipo,),
    )
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail=f"Tipo '{tipo}' não encontrado.")

    return [dict(r) for r in rows]


