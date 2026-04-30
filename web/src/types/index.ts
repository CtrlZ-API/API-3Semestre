export interface RegistroCredito {
  id: number;
  data: string;       // "2010-01-01 00:00:00"
  estado: string;     
  regiao: string;     
  tipo: string;       
  valor: number;
}

export interface ResumoEstado {
  estado: string;     
  regiao: string;     
  total: number;      
  media: number;      
}

export interface SerieHistorica {
  data: string;       // "2010-01-01 00:00:00"
  valor: number;
}

export interface RegistroHistorico {
  data: string;
  saldo: number;
  inadimplencia: number;
  variacao: number;
}

export interface ItemRanking {
  estado: string;  // nome completo do estado, ex: "São Paulo"
  uf: string;      // sigla, ex: "SP"
  regiao: string;
  score: number;   // 0–100
  posicao: number;
}

export type TipoIndicador = "saldo" | "inadimplencia" | "variacao";

export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
