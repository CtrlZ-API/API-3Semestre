import type { Regiao, RegistroCredito, ResumoEstado, SerieHistorica, TipoIndicador } from "../types";

const BASE_URL = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Erro ${res.status} em ${url}`);
  }

  return res.json() as Promise<T>;
}
