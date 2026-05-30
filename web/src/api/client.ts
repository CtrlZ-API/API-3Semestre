import type { ItemRanking, Regiao, RegistroCredito, RegistroHistorico, ResumoEstado, SerieHistorica, TipoIndicador } from "../types";

const BASE_URL = "/api";

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...options, headers: { ...headers, ...options?.headers } });

  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_usuario");
    window.location.hash = "/login";
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Erro ${res.status} em ${url}`);
  }

  return res.json() as Promise<T>;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  data_criacao: string;
}

export interface RespostaLogin {
  access_token: string;
  token_type: string;
  usuario: UsuarioLogado;
}

export async function login(email: string, senha: string): Promise<RespostaLogin> {
  return fetchJson<RespostaLogin>(`${BASE_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
}

export async function registrar(
  nome: string,
  email: string,
  senha: string,
  perfil: "analista" | "gestor"
): Promise<UsuarioLogado> {
  return fetchJson<UsuarioLogado>(`${BASE_URL}/auth/registrar`, {
    method: "POST",
    body: JSON.stringify({ nome, email, senha, perfil }),
  });
}

export function logout(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_usuario");
  window.location.hash = "/login";
}

export function getUsuarioLogado(): UsuarioLogado | null {
  const raw = localStorage.getItem("auth_usuario");
  if (!raw) return null;
  try { return JSON.parse(raw) as UsuarioLogado; } catch { return null; }
}

export function isAutenticado(): boolean {
  return !!localStorage.getItem("auth_token");
}

// ══════════════════════════════════════════════════════════════════════════════
// DADOS
// ══════════════════════════════════════════════════════════════════════════════

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
  if (regiao)     params.append("regiao",      regiao);
  return fetchJson(`${BASE_URL}/dados/estados/periodo?${params.toString()}`);
}

export function getDadosPorTipo(tipo: TipoIndicador): Promise<RegistroCredito[]> {
  return fetchJson(`${BASE_URL}/dados/tipo/${tipo}`);
}

export function getSerieEstado(uf: string, tipo: TipoIndicador = "saldo"): Promise<SerieHistorica[]> {
  return fetchJson(`${BASE_URL}/dados/estado/${uf}?tipo=${tipo}`);
}

export function getHistoricoGeral(
  regiao?: string,
  dataInicio?: string,
  dataFim?: string,
  estado?: string
): Promise<RegistroHistorico[]> {
  const params = new URLSearchParams();
  if (regiao)     params.append("regiao",      regiao);
  if (dataInicio) params.append("data_inicio", dataInicio);
  if (dataFim)    params.append("data_fim",    dataFim);
  if (estado)     params.append("estado",      estado);
  return fetchJson(`${BASE_URL}/dados/historico?${params.toString()}`);
}

export function getDadosPorPeriodo(
  dataInicio: string,
  dataFim: string,
  tipo?: TipoIndicador,
  estado?: string
): Promise<RegistroCredito[]> {
  const params = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
  if (tipo)   params.append("tipo",   tipo);
  if (estado) params.append("estado", estado);
  return fetchJson(`${BASE_URL}/dados/periodo/?${params.toString()}`);
}

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