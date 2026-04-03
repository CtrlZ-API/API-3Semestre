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



@app.get("/api/dados/estados/periodo")
def get_por_estados_periodo(
    tipo:        str = Query(default="saldo"),
    data_inicio: str = Query(default=None, description="Formato: YYYY-MM-DD"),
    data_fim:    str = Query(default=None, description="Formato: YYYY-MM-DD"),
    regiao:      str = Query(default=None),
):
    """
    Igual a /api/dados/estados mas com filtro opcional de período.
    Usado pelos cards, ranking e mapa quando o usuário define um intervalo.
    """
    conn = get_connection()
    cursor = conn.cursor()

    order_col = "media" if tipo == "variacao" else "total"

    query = """
        SELECT
            estado,
            regiao,
            ROUND(SUM(valor), 2) AS total,
            ROUND(AVG(valor), 2) AS media
        FROM dados_credito
        WHERE tipo = ?
    """
    params: list = [tipo]

    if data_inicio:
        query += " AND data >= ?"
        params.append(data_inicio)
    if data_fim:
        query += " AND data <= ?"
        params.append(data_fim)
    if regiao:
        query += " AND regiao = ?"
        params.append(regiao)

    query += f" GROUP BY estado, regiao ORDER BY {order_col} DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail=f"Tipo '{tipo}' não encontrado.")

    return [dict(r) for r in rows]

@app.get("/api/dados/tipo/{tipo}")
def get_por_tipo(tipo: str):
    """
    Retorna todos os registros de um tipo.
    tipo: 'saldo' | 'inadimplencia'
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM dados_credito WHERE tipo = ?",
        (tipo,),
    )
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail=f"Tipo '{tipo}' não encontrado.")

    return [dict(r) for r in rows]


@app.get("/api/dados/estado/{uf}")
def get_por_estado(uf: str, tipo: str = Query(default="saldo")):
    """
    Retorna a série histórica mensal de um estado.
    Usado pelo gráfico de linhas (tarefa 3.3).
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT data, valor
        FROM dados_credito
        WHERE estado = ? AND tipo = ?
        ORDER BY data ASC
        """,
        (uf.upper(), tipo),
    )
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Estado '{uf.upper()}' ou tipo '{tipo}' não encontrado.",
        )

    return [dict(r) for r in rows]


@app.get("/api/dados/periodo/")
def get_por_periodo(
    data_inicio: str = Query(..., description="Formato: YYYY-MM-DD"),
    data_fim: str    = Query(..., description="Formato: YYYY-MM-DD"),
    tipo: str        = Query(default=None),
    estado: str      = Query(default=None),
):
    """
    Filtra registros por período (e opcionalmente tipo e estado).
    Parâmetros opcionais: tipo, estado.
    """
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT * FROM dados_credito
        WHERE data BETWEEN ? AND ?
    """
    params: list = [data_inicio, data_fim]

    if tipo:
        query += " AND tipo = ?"
        params.append(tipo)
    if estado:
        query += " AND estado = ?"
        params.append(estado.upper())

    query += " ORDER BY data ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]