import os
import sqlite3
import time
from typing import Optional
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
    if score < 40:
        return ("Risco Alto",  "Alta inadimplência" )
    elif score < 54:
        return ("Moderado", "Inadimplência moderada")
    else:
        return ("Alta Oportunidade", "Baixa inadimplência")


# Cache simples em memória para rankings frequentes (TTL de 5 minutos)
_cache_ranking: dict = {}
_CACHE_TTL_SEGUNDOS = 300


def _calcular_ranking_bruto(
    regiao: Optional[str],
    estado: Optional[str],
    ano: Optional[int],
    mes: Optional[int],
    w_saldo: float,
    w_inad: float,
    w_var: float,
) -> list[dict]:
    """Consulta o banco, aplica filtros e calcula o score de oportunidade por estado."""
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            estado,
            regiao,
            MAX(CASE WHEN tipo = 'saldo' THEN valor ELSE 0 END)          AS v_saldo,
            MAX(CASE WHEN tipo = 'inadimplencia' THEN valor ELSE 0 END)  AS v_inad,
            MAX(CASE WHEN tipo = 'variacao' THEN valor ELSE 0 END)       AS v_var
        FROM dados_credito
        WHERE 1=1
    """
    params: list = []

    if regiao:
        query += " AND regiao = ?"
        params.append(regiao)
    if estado:
        query += " AND estado = ?"
        params.append(estado.upper())
    if ano:
        query += " AND strftime('%Y', data) = ?"
        params.append(str(ano))
    if mes:
        query += " AND strftime('%m', data) = ?"
        params.append(f"{mes:02d}")

    query += " GROUP BY estado, regiao"

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Erro interno no banco: {str(e)}")
    finally:
        conn.close()

    if not rows:
        return []

    dados = [dict(r) for r in rows]

    def get_min_max(key: str):
        vals = [d[key] for d in dados]
        return min(vals), max(vals)

    min_s, max_s = get_min_max("v_saldo")
    min_i, max_i = get_min_max("v_inad")
    min_v, max_v = get_min_max("v_var")

    resultado = []
    for d in dados:
        n_saldo = (d["v_saldo"] - min_s) / ((max_s - min_s) or 1)
        n_inad  = (d["v_inad"]  - min_i) / ((max_i - min_i) or 1)
        n_var   = (d["v_var"]   - min_v) / ((max_v - min_v) or 1)

        saude_credito = 1 - n_inad
        score_bruto   = (n_saldo * w_saldo) + (saude_credito * w_inad) + (n_var * w_var)
        score_final   = round(max(0.0, min(100.0, score_bruto * 100)), 2)

        resultado.append({
            "estado":  d["estado"],
            "uf":      d["estado"],   # preenchido com sigla abaixo
            "regiao":  d["regiao"],
            "score":   score_final,
        })

    return resultado


# Mapeamento nome completo → sigla UF (dados do banco armazenam a sigla no campo `estado`)
_SIGLA_PARA_NOME = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
    "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina",
    "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins",
}


@app.get("/api/ranking")
def get_ranking(
    top:    int            = Query(default=27, ge=1, le=27, description="Quantidade de estados a retornar"),
    regiao: Optional[str]  = Query(default=None, description="Região: Norte, Nordeste, Centro-Oeste, Sudeste ou Sul"),
    estado: Optional[str]  = Query(default=None, description="Sigla do estado, ex: SP"),
    ano:    Optional[int]  = Query(default=None, description="Ano de referência, ex: 2023"),
    mes:    Optional[int]  = Query(default=None, ge=1, le=12, description="Mês de referência (1-12)"),
    w_saldo: float = Query(default=0.3),
    w_inad:  float = Query(default=0.3),
    w_var:   float = Query(default=0.4),
):
    """
    Ranking de estados por score de oportunidade de crédito (0-100).
    Responde com filtros de região, estado, ano e mês.
    O resultado top-10 nacional (sem filtros) é armazenado em cache por 5 minutos.
    """
    chave_cache = (top, regiao, estado, ano, mes, w_saldo, w_inad, w_var)
    agora = time.time()

    # Verifica cache
    if chave_cache in _cache_ranking:
        dados_cache, timestamp = _cache_ranking[chave_cache]
        if agora - timestamp < _CACHE_TTL_SEGUNDOS:
            return dados_cache

    ranking_bruto = _calcular_ranking_bruto(regiao, estado, ano, mes, w_saldo, w_inad, w_var)

    if not ranking_bruto:
        return []

    # Ordena por score decrescente e aplica o limite
    ranking_ordenado = sorted(ranking_bruto, key=lambda x: x["score"], reverse=True)[:top]

    # Enriquece com UF (sigla) e nome completo do estado
    resultado = []
    for i, item in enumerate(ranking_ordenado):
        sigla = item["estado"]  # banco armazena a sigla no campo estado
        resultado.append({
            "estado":  _SIGLA_PARA_NOME.get(sigla, sigla),
            "uf":      sigla,
            "regiao":  item["regiao"],
            "score":   item["score"],
            "posicao": i + 1,
        })

    # Armazena no cache
    _cache_ranking[chave_cache] = (resultado, agora)

    return resultado

# ── População por estado (Censo 2022 — IBGE) ──
POPULACAO_ESTADOS = {
    "AC": 906_876,    "AL": 3_127_683,  "AM": 4_269_995,  "AP": 877_613,
    "BA": 14_873_064, "CE": 9_240_580,  "DF": 2_817_381,  "ES": 4_108_508,
    "GO": 7_206_589,  "MA": 7_114_598,  "MG": 21_292_666, "MS": 2_756_700,
    "MT": 3_658_813,  "PA": 8_777_124,  "PB": 4_059_905,  "PR": 11_597_484,
    "PE": 9_674_793,  "PI": 3_289_290,  "RJ": 16_054_524, "RN": 3_534_165,
    "RS": 11_466_630, "RO": 1_815_278,  "RR": 652_713,    "SC": 7_610_361,
    "SP": 44_420_459, "SE": 2_338_474,  "TO": 1_607_363,
}

# Cache separado para o v2 (cálculo mais pesado — TTL maior: 10 minutos)
_cache_ranking_v2: dict = {}
_CACHE_TTL_V2 = 600


def _calcular_ranking_v2_bruto(
    regiao: Optional[str],
    w_saldo: float,
    w_inad: float,
    w_tendencia: float,
    w_consistencia: float,
    w_penetracao: float,
) -> list[dict]:
    """
    Calcula o score v2 com tendência 12m, consistência 3 anos e penetração per capita.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # ── 1. Saldo e inadimplência do último mês disponível ──
    query_atual = """
        SELECT
            estado, regiao,
            MAX(CASE WHEN tipo = 'saldo'         THEN valor ELSE 0 END) AS v_saldo,
            MAX(CASE WHEN tipo = 'inadimplencia' THEN valor ELSE 0 END) AS v_inad
        FROM dados_credito
        WHERE data = (SELECT MAX(data) FROM dados_credito)
    """
    if regiao:
        query_atual += " AND regiao = ?"
        cursor.execute(query_atual + " GROUP BY estado, regiao", (regiao,))
    else:
        cursor.execute(query_atual + " GROUP BY estado, regiao")

    rows_atual = {r["estado"]: dict(r) for r in cursor.fetchall()}

    # ── 2. Tendência: média últimos 12m vs 12m anteriores ──
    query_tend = """
        SELECT
            estado,
            ROUND(
                AVG(CASE WHEN data >= date('now', '-12 months')
                         THEN valor END) -
                AVG(CASE WHEN data <  date('now', '-12 months')
                          AND data >= date('now', '-24 months')
                         THEN valor END)
            , 2) AS tendencia
        FROM dados_credito
        WHERE tipo = 'saldo'
          AND data >= date('now', '-24 months')
    """
    if regiao:
        query_tend += " AND regiao = ? GROUP BY estado"
        cursor.execute(query_tend, (regiao,))
    else:
        cursor.execute(query_tend + " GROUP BY estado")

    rows_tend = {r["estado"]: (r["tendencia"] or 0) for r in cursor.fetchall()}

    # ── 3. Consistência: coeficiente de variação dos últimos 3 anos ──
    # SQLite não tem STDDEV nativo — usamos a fórmula: sqrt(E[x²] - E[x]²)
    query_consist = """
        SELECT
            estado,
            ROUND(
                (CAST(
                    sqrt(AVG(valor * valor) - AVG(valor) * AVG(valor))
                AS REAL) / NULLIF(AVG(valor), 0)) * 100
            , 2) AS coef_variacao
        FROM dados_credito
        WHERE tipo = 'saldo'
          AND data >= date('now', '-3 years')
    """
    if regiao:
        query_consist += " AND regiao = ? GROUP BY estado"
        cursor.execute(query_consist, (regiao,))
    else:
        cursor.execute(query_consist + " GROUP BY estado")

    rows_consist = {r["estado"]: (r["coef_variacao"] or 0) for r in cursor.fetchall()}

    conn.close()

    if not rows_atual:
        return []

    # ── Monta estrutura unificada ──
    dados = []
    for estado, d in rows_atual.items():
        pop = POPULACAO_ESTADOS.get(estado, 1)
        dados.append({
            "estado":           estado,
            "regiao":           d["regiao"],
            "v_saldo":          d["v_saldo"],
            "v_inad":           d["v_inad"],
            "tendencia":        rows_tend.get(estado, 0),
            "coef_variacao":    rows_consist.get(estado, 0),
            "saldo_per_capita": d["v_saldo"] / pop,
        })

    if not dados:
        return []

    # ── Normalização Min-Max com suporte a inversão ──
    def norm(key: str, inverter: bool = False) -> dict:
        vals = [d[key] for d in dados]
        mn, mx = min(vals), max(vals)
        dif = (mx - mn) or 1
        if inverter:
            return {d["estado"]: 1 - (d[key] - mn) / dif for d in dados}
        return {d["estado"]: (d[key] - mn) / dif for d in dados}

    n_saldo       = norm("v_saldo")
    n_inad        = norm("v_inad",           inverter=True)  # menor inad = melhor
    n_tendencia   = norm("tendencia")
    n_consist     = norm("coef_variacao",    inverter=True)  # menor variação = mais estável
    n_penetracao  = norm("saldo_per_capita", inverter=True)  # menor per capita = mercado inexplorado

    resultado = []
    for d in dados:
        uf = d["estado"]
        score_bruto = (
            n_saldo[uf]     * w_saldo        +
            n_inad[uf]      * w_inad         +
            n_tendencia[uf] * w_tendencia    +
            n_consist[uf]   * w_consistencia +
            n_penetracao[uf]* w_penetracao
        )
        score_final = round(max(0.0, min(100.0, score_bruto * 100)), 2)

        resultado.append({
            "estado":  _SIGLA_PARA_NOME.get(uf, uf),
            "uf":      uf,
            "regiao":  d["regiao"],
            "score":   score_final,
            "componentes": {
                "volume":       round(n_saldo[uf]      * 100, 1),
                "saude":        round(n_inad[uf]        * 100, 1),
                "tendencia":    round(n_tendencia[uf]   * 100, 1),
                "estabilidade": round(n_consist[uf]     * 100, 1),
                "penetracao":   round(n_penetracao[uf]  * 100, 1),
            },
            "indicadores_brutos": {
                "saldo_ultimo_mes":  d["v_saldo"],
                "inadimplencia":     d["v_inad"],
                "tendencia_12m":     d["tendencia"],
                "coef_variacao_3a":  d["coef_variacao"],
                "saldo_per_capita":  round(d["saldo_per_capita"], 2),
            },
        })

    return resultado


@app.get("/api/opurtunidade/ranking/v2")
def get_ranking_v2(
    top:    int           = Query(default=27, ge=1, le=27),
    regiao: Optional[str] = Query(default=None, description="Norte | Nordeste | Centro-Oeste | Sudeste | Sul"),
    w_saldo:        float = Query(default=0.15, description="Peso volume absoluto"),
    w_inad:         float = Query(default=0.25, description="Peso saúde de crédito"),
    w_tendencia:    float = Query(default=0.25, description="Peso tendência 12 meses"),
    w_consistencia: float = Query(default=0.10, description="Peso estabilidade 3 anos"),
    w_penetracao:   float = Query(default=0.25, description="Peso mercado inexplorado per capita"),
):
    """
    Ranking v2 — corrige problema do snapshot único (P4) e viés de volume (P5).

    Melhorias sobre /api/ranking:
    - Tendência: compara média dos últimos 12m vs 12m anteriores (não só último mês)
    - Estabilidade: penaliza estados com alta volatilidade histórica (3 anos)
    - Penetração: favorece estados com baixo saldo per capita (mercado inexplorado)
    """
    chave_cache = (top, regiao, w_saldo, w_inad, w_tendencia, w_consistencia, w_penetracao)
    agora = time.time()

    if chave_cache in _cache_ranking_v2:
        dados_cache, timestamp = _cache_ranking_v2[chave_cache]
        if agora - timestamp < _CACHE_TTL_V2:
            return dados_cache

    ranking_bruto = _calcular_ranking_v2_bruto(
        regiao, w_saldo, w_inad, w_tendencia, w_consistencia, w_penetracao
    )

    if not ranking_bruto:
        return []

    ranking_ordenado = sorted(ranking_bruto, key=lambda x: x["score"], reverse=True)[:top]

    # Adiciona posição após ordenar
    resultado = [
        {**item, "posicao": i + 1}
        for i, item in enumerate(ranking_ordenado)
    ]

    _cache_ranking_v2[chave_cache] = (resultado, agora)
    return resultado
