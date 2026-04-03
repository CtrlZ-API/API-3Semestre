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

export type TipoIndicador = "saldo" | "inadimplencia" | "variacao";

export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
