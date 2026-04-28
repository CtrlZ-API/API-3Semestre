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
        return []

    resultado = []

    for i in rows:
        d = dict(i)
    
        score = d["media"]
        categoria, insight = definir_score(score)

        d["categoria"] = categoria
        d["insight"] = insight

        resultado.append(d)

    return resultado



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
        params.append(f"{data_inicio} 00:00:00")
    if data_fim:
        query += " AND data <= ?"
        params.append(f"{data_fim} 23:59:59")
    if regiao:
        query += " AND regiao = ?"
        params.append(regiao)

    query += f" GROUP BY estado, regiao ORDER BY {order_col} DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return []

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
        return []

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
        return []

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

@app.get("/api/dados/historico")
def get_historico_geral(
    regiao:      str = Query(default=None),
    data_inicio: str = Query(default=None),
    data_fim:    str = Query(default=None),
    estado:      str = Query(default=None)
):
    """
    Retorna a série histórica agregada (nacional ou por região) para os 3 indicadores.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # CASE WHEN com NULL garante que o AVG ignore os registros que não são do tipo 'inadimplencia'
    query_base = """
        SELECT 
            data,
            ROUND(SUM(CASE WHEN tipo = 'saldo' THEN valor ELSE 0 END), 2) as saldo,
            ROUND(AVG(CASE WHEN tipo = 'inadimplencia' THEN valor ELSE NULL END), 2) as inadimplencia,
            ROUND(SUM(CASE WHEN tipo = 'variacao' THEN valor ELSE 0 END), 2) as variacao
        FROM dados_credito
        WHERE 1=1
    """
    params = []
    
    if regiao:
        query_base += " AND regiao = ?"
        params.append(regiao)
    if estado:
        query_base += " AND estado = ?"
        params.append(estado.upper())
    if data_inicio:
        # Garante comparação inclusiva com o início do dia
        query_base += " AND data >= ?"
        params.append(f"{data_inicio} 00:00:00")
    if data_fim:
        # Garante comparação inclusiva com o fim do dia (evita o problema da string mais longa)
        query_base += " AND data <= ?"
        params.append(f"{data_fim} 23:59:59")
        
    query_base += " GROUP BY data ORDER BY data ASC"
    
    cursor.execute(query_base, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(r) for r in rows]

@app.get("/api/oportunidade/ranking")
def get_ranking_oportunidade(
    # Query Params permitem que o Front-end envie pesos diferentes sem mudar o código.
    # Exemplo: /ranking?w_inad=-0.8 (dando mais peso negativo ao risco)
    w_saldo: float = Query(0.3, description="Peso Saldo (Quanto maior o volume, melhor)"),
    w_inad: float = Query(0.3, description="Peso Saúde de Crédito (Inverso da inadimplência)"),
    w_var: float = Query(0.4, description="Peso Variação (Potencial de crescimento)")
):
    """
    Calcula um Score de Oportunidade (0-100) para cada estado.
    Utiliza Normalização Min-Max real para comparar indicadores de grandezas diferentes.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Buscamos os dados mais recentes
    query = """
        SELECT 
            estado,
            regiao,
            MAX(CASE WHEN tipo = 'saldo' THEN valor ELSE 0 END) as v_saldo,
            MAX(CASE WHEN tipo = 'inadimplencia' THEN valor ELSE 0 END) as v_inad,
            MAX(CASE WHEN tipo = 'variacao' THEN valor ELSE 0 END) as v_var
        FROM dados_credito
        WHERE data = (SELECT MAX(data) FROM dados_credito)
        GROUP BY estado, regiao
    """
    
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Erro interno no banco: {str(e)}")
    finally:
        conn.close()

    if not rows:
        return []

    dados = [dict(r) for r in rows]

    # Para uma normalização Min-Max justa, precisamos dos mínimos e máximos de cada indicador
    def get_min_max(key):
        vals = [d[key] for d in dados]
        return min(vals), max(vals)

    min_s, max_s = get_min_max("v_saldo")
    min_i, max_i = get_min_max("v_inad")
    min_v, max_v = get_min_max("v_var")

    ranking = []

    for d in dados:
        # Normalização Min-Max (0.0 a 1.0)
        # O "or 1" no divisor evita divisão por zero se todos os valores forem iguais
        n_saldo = (d["v_saldo"] - min_s) / ((max_s - min_s) or 1)
        n_inad  = (d["v_inad"] - min_i) / ((max_i - min_i) or 1)
        n_var   = (d["v_var"] - min_v) / ((max_v - min_v) or 1)

        # Inversão da Inadimplência: 
        # Como queremos um score de OPORTUNIDADE, quanto MENOR a inadimplência, MELHOR.
        # n_inad = 1 significa a pior inadimplência do grupo. 
        # (1 - n_inad) transforma isso em 0 (pior saúde).
        saude_credito = 1 - n_inad

        # Cálculo do Score Final
        # Somamos as contribuições positivas. Se os pesos somarem 1.0, o resultado estará entre 0 e 1.
        score_bruto = (n_saldo * w_saldo) + (saude_credito * w_inad) + (n_var * w_var)
        
        # Escala de 0 a 100
        score_final = round(max(0.0, min(100.0, score_bruto * 100)), 2)

        # Montamos a estrutura de resposta que o Front-end espera.
        ranking.append({
            "estado": d["estado"],
            "regiao": d["regiao"],
            "score_oportunidade": score_final,
            "indicadores": {
                "saldo_bruto": d["v_saldo"],
                "inadimplencia_bruto": d["v_inad"],
                "variacao_bruta": d["v_var"]
            }
        })

    # Ordenamos a lista do maior score para o menor antes de enviar para a API.
    return sorted(ranking, key=lambda x: x["score_oportunidade"], reverse=True)

def definir_score (score):
    if score <= 40:
        return ("Risco Alto",  "Alta inadimplência" )
    elif score <= 70:
        return ("Moderado", "Inadimplência moderada")
    else:
        return ("Alta Oportunidade", "Baixa inadimplência")
