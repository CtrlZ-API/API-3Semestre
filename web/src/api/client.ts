import type { ItemRanking, Regiao, RegistroCredito, RegistroHistorico, ResumoEstado, SerieHistorica, TipoIndicador } from "../types";

const BASE_URL = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Erro ${res.status} em ${url}`);
  }

  return res.json() as Promise<T>;
}

export function getDados(limite = 100): Promise<RegistroCredito[]> {
  return fetchJson(`${BASE_URL}/dados?limite=${limite}`);
}

export function getDadosPorEstados(tipo: TipoIndicador = "saldo"): Promise<ResumoEstado[]> {
  return fetchJson(`${BASE_URL}/dados/estados?tipo=${tipo}`);
}

export function getDadosPorEstadosPeriodo(
  tipo: TipoIndicador = "saldo",
  dataInicio?: string,
  dataFim?: string,
  regiao?: Regiao
): Promise<ResumoEstado[]> {
  const params = new URLSearchParams({ tipo });
  if (dataInicio) params.append("data_inicio", dataInicio);
  if (dataFim)    params.append("data_fim",    dataFim);
  if (regiao) params.append("regiao", regiao)
  return fetchJson(`${BASE_URL}/dados/estados/periodo?${params.toString()}`);
}

export function getDadosPorTipo(tipo: TipoIndicador): Promise<RegistroCredito[]> {
  return fetchJson(`${BASE_URL}/dados/tipo/${tipo}`);
}

/**
 * Série histórica de um estado — para o gráfico de linhas (3.3).
 */
export function getSerieEstado(
  uf: string,
  tipo: TipoIndicador = "saldo"
): Promise<SerieHistorica[]> {
  return fetchJson(`${BASE_URL}/dados/estado/${uf}?tipo=${tipo}`);
}

export function getHistoricoGeral(
  regiao?: string,
  dataInicio?: string,
  dataFim?: string,
  estado?: string
): Promise<RegistroHistorico[]> {
  const params = new URLSearchParams();
  if (regiao) params.append("regiao", regiao);
  if (dataInicio) params.append("data_inicio", dataInicio);
  if (dataFim) params.append("data_fim", dataFim);
  if (estado) params.append("estado", estado);
  return fetchJson(`${BASE_URL}/dados/historico?${params.toString()}`);
}

// Datas no formato "YYYY-MM-DD".
export function getDadosPorPeriodo(
  dataInicio: string,
  dataFim: string,
  tipo?: TipoIndicador,
  estado?: string
): Promise<RegistroCredito[]> {
  const params = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
  if (tipo)   params.append("tipo", tipo);
  if (estado) params.append("estado", estado);
  return fetchJson(`${BASE_URL}/dados/periodo/?${params.toString()}`);
}

/**
 * Ranking de estados por score de oportunidade de crédito.
 * Usado pelo mapa coroplético — alimenta a escala de cores.
 */
export function getRanking(params?: {
  top?: number;
  regiao?: string;
  estado?: string;
  ano?: number;
  mes?: number;
}): Promise<ItemRanking[]> {
  const qs = new URLSearchParams();
  if (params?.top)    qs.append("top",    String(params.top));
  if (params?.regiao) qs.append("regiao", params.regiao);
  if (params?.estado) qs.append("estado", params.estado);
  if (params?.ano)    qs.append("ano",    String(params.ano));
  if (params?.mes)    qs.append("mes",    String(params.mes));
  const sufixo = qs.toString() ? `?${qs.toString()}` : "";
  return fetchJson(`${BASE_URL}/ranking${sufixo}`);
}